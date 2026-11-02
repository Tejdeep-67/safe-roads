"""Measure the exported ONNX model on a labelled pothole test set.

Uses the same letterbox / NMS as the web app, so this is the number for the
model as it runs in the browser (not the PyTorch training pipeline).

Dataset: "Potholes Detection" (Roboflow Universe, project-ssayl, CC BY 4.0),
mirrored on Hugging Face as Ryukijano/Pothole-detection-Yolov8. Labels are
YOLO boxes. None of these images were in the Kaggle set the model was trained on
as far as I can tell, so it is more of a "different data" test.

usage:
    python evaluate.py --model ../public/models/pothole-yolov8n-seg.onnx --data eval_ds --split test --imgsz 640
"""
import argparse
import glob
import json
import os
import time

import numpy as np
import onnxruntime as ort
from PIL import Image

from yolo_utils import decode, iou, letterbox


def load_labels(path, w, h):
    boxes = []
    if os.path.exists(path):
        for line in open(path):
            p = line.split()
            if len(p) < 5:
                continue
            cx, cy, bw, bh = map(float, p[1:5])
            boxes.append([(cx - bw / 2) * w, (cy - bh / 2) * h, (cx + bw / 2) * w, (cy + bh / 2) * h])
    return np.array(boxes).reshape(-1, 4)


def average_precision(recall, precision):
    # COCO style 101 point interpolation
    mrec = np.concatenate(([0.0], recall, [1.0]))
    mpre = np.concatenate(([1.0], precision, [0.0]))
    mpre = np.flip(np.maximum.accumulate(np.flip(mpre)))
    x = np.linspace(0, 1, 101)
    return np.trapezoid(np.interp(x, mrec, mpre), x)


def evaluate(dets, gts, iou_thr):
    """dets: list of (img_id, score, box). gts: dict img_id -> array of boxes."""
    n_gt = sum(len(g) for g in gts.values())
    dets = sorted(dets, key=lambda d: -d[1])
    used = {k: np.zeros(len(v), bool) for k, v in gts.items()}
    tp = np.zeros(len(dets))
    for i, (img, score, box) in enumerate(dets):
        g = gts[img]
        if len(g) == 0:
            continue
        ious = iou(box, g)
        j = int(ious.argmax())
        if ious[j] >= iou_thr and not used[img][j]:
            used[img][j] = True
            tp[i] = 1
    ctp = np.cumsum(tp)
    cfp = np.cumsum(1 - tp)
    recall = ctp / max(n_gt, 1)
    precision = ctp / np.maximum(ctp + cfp, 1e-9)
    return average_precision(recall, precision), tp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--data", required=True)
    ap.add_argument("--split", default="test")
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--app-conf", type=float, default=0.35, help="threshold used for P/R (app default)")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    sess = ort.InferenceSession(args.model, providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0].name
    images = sorted(glob.glob(os.path.join(args.data, args.split, "images", "*.jpg")))
    dets, gts, times = [], {}, []
    for k, path in enumerate(images):
        img = Image.open(path).convert("RGB")
        w, h = img.size
        x, scale, px, py = letterbox(img, args.imgsz)
        t = time.perf_counter()
        out = sess.run(None, {inp: x})
        times.append(time.perf_counter() - t)
        # low conf threshold for mAP, like ultralytics val
        boxes, scores = decode(out[0], scale, px, py, w, h, conf=0.001, iou_thr=0.6)
        for b, s in zip(boxes, scores):
            dets.append((k, float(s), b))
        lab = os.path.join(args.data, args.split, "labels", os.path.splitext(os.path.basename(path))[0] + ".txt")
        gts[k] = load_labels(lab, w, h)

    n_gt = sum(len(g) for g in gts.values())
    ap50, _ = evaluate(dets, gts, 0.5)
    ap_range = [evaluate(dets, gts, t)[0] for t in np.arange(0.5, 0.96, 0.05)]

    # precision / recall at the threshold the app uses by default
    app = [d for d in dets if d[1] >= args.app_conf]
    _, tp = evaluate(app, gts, 0.5)
    p = tp.sum() / max(len(app), 1)
    r = tp.sum() / max(n_gt, 1)

    res = {
        "model": os.path.basename(args.model),
        "imgsz": args.imgsz,
        "split": args.split,
        "images": len(images),
        "ground_truth_boxes": int(n_gt),
        "mAP50": round(float(ap50), 3),
        "mAP50_95": round(float(np.mean(ap_range)), 3),
        f"precision@conf{args.app_conf}": round(float(p), 3),
        f"recall@conf{args.app_conf}": round(float(r), 3),
        "f1": round(float(2 * p * r / max(p + r, 1e-9)), 3),
        "cpu_ms_per_image_onnxruntime": round(1000 * float(np.median(times)), 1),
    }
    print(json.dumps(res, indent=2))
    if args.out:
        with open(args.out, "w") as f:
            json.dump(res, f, indent=2)


if __name__ == "__main__":
    main()
