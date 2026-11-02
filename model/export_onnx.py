"""Export backend/routes/best.pt to ONNX for the browser.

The checkpoint is a YOLOv8n-seg model with one class ("Pothole"), trained at 640.
I export with dynamic height/width so the web app can pick the input size
(320 / 416 / 640) depending on how fast the device is.

    pip install ultralytics onnx onnxslim
    python export_onnx.py
"""
import shutil
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent
WEIGHTS = ROOT / "backend" / "routes" / "best.pt"
OUT = ROOT / "public" / "models" / "pothole-yolov8n-seg.onnx"

model = YOLO(str(WEIGHTS))
print("task:", model.task, "classes:", model.names)
path = model.export(format="onnx", imgsz=640, dynamic=True, simplify=True, opset=17)
OUT.parent.mkdir(parents=True, exist_ok=True)
shutil.move(path, OUT)
print("saved", OUT, round(OUT.stat().st_size / 1e6, 1), "MB")
