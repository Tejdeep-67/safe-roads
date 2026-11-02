"""These run the real model, so they take a few seconds the first time."""
import io
import os

import pytest
from PIL import Image

import detector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEMO = os.path.join(ROOT, "public", "demo", "pothole-2.jpg")

needs_model = pytest.mark.skipif(not os.path.exists(detector.MODEL_PATH), reason="models/best.pt missing")


def test_health(client):
    body = client.get("/api/health").get_json()
    assert body["ok"] is True


def test_severity_rule():
    # a big pothole low in the frame is high, a small one far away is low
    assert detector.estimate_severity(100, 300, 500, 480, 0.8, 640, 480) == "high"
    assert detector.estimate_severity(300, 100, 330, 120, 0.8, 640, 480) == "low"


def test_detect_needs_an_image(client):
    assert client.post("/api/detect").status_code == 400
    r = client.post("/api/detect", data={"image": (io.BytesIO(b"not an image"), "x.jpg")})
    assert r.status_code == 400


def test_detect_validates_params(client):
    img = io.BytesIO()
    Image.new("RGB", (64, 64), "gray").save(img, "JPEG")
    img.seek(0)
    r = client.post("/api/detect", data={"image": (img, "x.jpg"), "imgsz": "999"})
    assert r.status_code == 400


@needs_model
def test_detect_finds_pothole_in_demo_photo(client):
    with open(DEMO, "rb") as f:
        r = client.post("/api/detect", data={"image": (f, "pothole.jpg"), "conf": "0.35"})
    assert r.status_code == 200
    body = r.get_json()
    assert body["count"] >= 1
    top = body["detections"][0]
    assert top["score"] > 0.5
    assert 0 <= top["x1"] < top["x2"] <= body["width"]
    assert top["severity"] in {"low", "medium", "high"}


@needs_model
def test_blank_image_has_no_potholes(client):
    img = io.BytesIO()
    Image.new("RGB", (640, 480), (120, 120, 120)).save(img, "PNG")
    img.seek(0)
    body = client.post("/api/detect", data={"image": (img, "blank.png")}).get_json()
    assert body["count"] == 0 and body["gps"] is None
