"""Pothole detection with the trained YOLOv8n-seg weights (models/best.pt)."""
from __future__ import annotations

import os
import threading
from dataclasses import dataclass, asdict

from PIL import Image

MODEL_PATH = os.environ.get("SAFE_ROADS_MODEL", os.path.join(os.path.dirname(__file__), "models", "best.pt"))

_model = None
_lock = threading.Lock()


@dataclass
class Detection:
    x1: float
    y1: float
    x2: float
    y2: float
    score: float
    severity: str
    area_frac: float  # share of the image covered by the mask (or box if no mask)


def estimate_severity(x1: float, y1: float, x2: float, y2: float, score: float, w: int, h: int, area_frac: float | None = None) -> str:
    """Same rough rule as the web app: bigger and lower in the frame = closer and worse.

    It is a size heuristic, not a depth measurement.
    """
    frac = area_frac if area_frac is not None else ((x2 - x1) * (y2 - y1)) / (w * h)
    bottom = y2 / h
    perspective = 0.4 + 0.6 * bottom
    size = (frac ** 0.5) / perspective
    if size > 0.28 and score > 0.45:
        return "high"
    if size > 0.13:
        return "medium"
    return "low"


def get_model():
    global _model
    with _lock:
        if _model is None:
            from ultralytics import YOLO  # imported here so the API starts fast

            if not os.path.exists(MODEL_PATH):
                raise FileNotFoundError(f"model weights not found at {MODEL_PATH}")
            _model = YOLO(MODEL_PATH, task="segment")
        return _model


def detect(image: Image.Image, conf: float = 0.35, imgsz: int = 640) -> list[dict]:
    image = image.convert("RGB")
    w, h = image.size
    model = get_model()
    with _lock:  # the model object is not thread safe
        result = model.predict(image, conf=conf, imgsz=imgsz, iou=0.45, verbose=False)[0]
    out: list[dict] = []
    if result.boxes is None or len(result.boxes) == 0:
        return out
    boxes = result.boxes.xyxy.cpu().numpy()
    scores = result.boxes.conf.cpu().numpy()
    fracs = None
    if result.masks is not None:
        m = result.masks.data.cpu().numpy()  # n x mh x mw at the model's letterboxed size
        fracs = m.reshape(len(m), -1).mean(axis=1)
    for i, (b, s) in enumerate(zip(boxes, scores)):
        x1, y1, x2, y2 = (float(v) for v in b)
        frac = float(fracs[i]) if fracs is not None else ((x2 - x1) * (y2 - y1)) / (w * h)
        out.append(
            asdict(
                Detection(
                    x1=round(x1, 1), y1=round(y1, 1), x2=round(x2, 1), y2=round(y2, 1),
                    score=round(float(s), 3),
                    severity=estimate_severity(x1, y1, x2, y2, float(s), w, h, frac),
                    area_frac=round(frac, 4),
                )
            )
        )
    out.sort(key=lambda d: -d["score"])
    return out
