"""Check that the ONNX export gives the same output as the PyTorch model.

Runs both on a few images (same letterboxed input tensor) and compares the raw
detection head output and the final boxes after NMS.

    python check_onnx.py ../public/demo/*.jpg
"""
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from PIL import Image
from ultralytics import YOLO

from yolo_utils import decode, letterbox

ROOT = Path(__file__).resolve().parent.parent
pt = YOLO(str(ROOT / "backend" / "routes" / "best.pt")).model.float().eval()
sess = ort.InferenceSession(str(ROOT / "public" / "models" / "pothole-yolov8n-seg.onnx"),
                            providers=["CPUExecutionProvider"])

worst = 0.0
for path in sys.argv[1:]:
    img = Image.open(path).convert("RGB")
    for size in (320, 416, 640):
        x, scale, px, py = letterbox(img, size)
        with torch.no_grad():
            t_out = pt(torch.from_numpy(x))
        while isinstance(t_out, (list, tuple)):  # seg model returns (preds, extras)
            t_out = t_out[0]
        t0 = t_out.numpy()
        o0 = sess.run(None, {"images": x})[0]
        diff = float(np.abs(t0 - o0).max())
        worst = max(worst, diff)
        bt, st = decode(t0, scale, px, py, *img.size, conf=0.25)
        bo, so = decode(o0, scale, px, py, *img.size, conf=0.25)
        same = len(bt) == len(bo) and (len(bt) == 0 or np.abs(bt - bo).max() < 1.0)
        print(f"{Path(path).name:28s} size={size}  max|diff|={diff:.2e}  boxes torch={len(bt)} onnx={len(bo)}  match={same}")
print("worst raw difference:", worst)
