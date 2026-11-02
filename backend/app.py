"""Safe Roads local API.

The web app does not need this: detection runs in the browser and reports go to a
Netlify Function. This API is for running the original PyTorch model on a server
(or from scripts) and for keeping reports in a local SQLite file.

    python app.py            # http://127.0.0.1:5000
"""
from __future__ import annotations

import io
import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError

import detector
from gps import gps_from_image
from hazards import HazardStore, ValidationError, validate

ALLOWED_SIZES = {320, 416, 480, 640, 800}
MAX_UPLOAD_MB = 10


def create_app(db_path: str | None = None) -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
    CORS(app, resources={r"/api/*": {"origins": os.environ.get("SAFE_ROADS_CORS", "*")}})
    store = HazardStore(db_path or os.environ.get("SAFE_ROADS_DB", os.path.join(os.path.dirname(__file__), "saferoads.db")))
    app.extensions["hazard_store"] = store

    @app.get("/api/health")
    def health():
        return jsonify(ok=True, model=os.path.basename(detector.MODEL_PATH), model_found=os.path.exists(detector.MODEL_PATH))

    @app.post("/api/detect")
    def detect():
        file = request.files.get("image")
        if file is None or file.filename == "":
            return jsonify(error="send the photo as multipart field 'image'"), 400
        try:
            conf = float(request.form.get("conf", 0.35))
            imgsz = int(request.form.get("imgsz", 640))
        except ValueError:
            return jsonify(error="conf must be a number and imgsz an integer"), 400
        if not 0.05 <= conf <= 0.95:
            return jsonify(error="conf must be between 0.05 and 0.95"), 400
        if imgsz not in ALLOWED_SIZES:
            return jsonify(error=f"imgsz must be one of {sorted(ALLOWED_SIZES)}"), 400
        try:
            image = Image.open(io.BytesIO(file.read()))
            image.load()
        except (UnidentifiedImageError, OSError):
            return jsonify(error="that file is not an image I can read"), 400
        gps = gps_from_image(image)
        try:
            dets = detector.detect(image, conf=conf, imgsz=imgsz)
        except FileNotFoundError as e:
            return jsonify(error=str(e)), 503
        return jsonify(
            width=image.width,
            height=image.height,
            count=len(dets),
            detections=dets,
            gps={"lat": gps[0], "lng": gps[1]} if gps else None,
        )

    @app.get("/api/hazards")
    def list_hazards():
        hazards = store.list()
        return jsonify(hazards=hazards, count=len(hazards))

    @app.post("/api/hazards")
    def add_hazard():
        if request.content_length and request.content_length > 2048:
            return jsonify(error="body too large"), 413
        body = request.get_json(silent=True)
        if body is None:
            return jsonify(error="invalid JSON"), 400
        try:
            value = validate(body)
        except ValidationError as e:
            return jsonify(error=str(e)), 400
        ok, retry = store.allow(request.remote_addr or "unknown")
        if not ok:
            resp = jsonify(error="too many reports, try again later")
            resp.headers["Retry-After"] = str(retry)
            return resp, 429
        hazard, merged = store.add(value)
        return jsonify(hazard=hazard, merged=merged), 200 if merged else 201

    @app.errorhandler(413)
    def too_large(_e):
        return jsonify(error=f"file too large (max {MAX_UPLOAD_MB} MB)"), 413

    @app.errorhandler(404)
    def not_found(_e):
        return jsonify(error="not found"), 404

    @app.errorhandler(405)
    def not_allowed(_e):
        return jsonify(error="method not allowed"), 405

    return app


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    create_app().run(host="127.0.0.1", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
