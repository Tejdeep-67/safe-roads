"""Small helpers shared by the model scripts.

These mirror what the browser worker does (src/detection/worker.ts) so the
numbers measured here are for the same pre/post-processing the app uses.
"""
import numpy as np
from PIL import Image


def letterbox(img, size):
    """Resize keeping aspect ratio and pad to size x size (grey 114 like ultralytics)."""
    w, h = img.size
    scale = min(size / w, size / h)
    nw, nh = round(w * scale), round(h * scale)
    resized = img.resize((nw, nh), Image.BILINEAR)
    canvas = Image.new("RGB", (size, size), (114, 114, 114))
    padx, pady = (size - nw) // 2, (size - nh) // 2
    canvas.paste(resized, (padx, pady))
    arr = np.asarray(canvas, dtype=np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)[None]  # 1x3xHxW
    return np.ascontiguousarray(arr), scale, padx, pady


def iou(box, boxes):
    """IoU of one box against many, boxes as x1,y1,x2,y2."""
    x1 = np.maximum(box[0], boxes[:, 0])
    y1 = np.maximum(box[1], boxes[:, 1])
    x2 = np.minimum(box[2], boxes[:, 2])
    y2 = np.minimum(box[3], boxes[:, 3])
    inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
    a = (box[2] - box[0]) * (box[3] - box[1])
    b = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
    return inter / (a + b - inter + 1e-9)


def nms(boxes, scores, iou_thr=0.45):
    order = scores.argsort()[::-1]
    keep = []
    while order.size:
        i = order[0]
        keep.append(i)
        if order.size == 1:
            break
        rest = order[1:]
        order = rest[iou(boxes[i], boxes[rest]) < iou_thr]
    return keep


def decode(output0, scale, padx, pady, img_w, img_h, conf=0.25, iou_thr=0.45):
    """output0 is 1 x 37 x N for the seg model (4 box, 1 class score, 32 mask coeffs).
    Returns boxes in original image pixels (x1,y1,x2,y2) and scores."""
    pred = output0[0]
    scores = pred[4]
    m = scores > conf
    if not m.any():
        return np.zeros((0, 4)), np.zeros(0)
    cx, cy, w, h = pred[0][m], pred[1][m], pred[2][m], pred[3][m]
    s = scores[m]
    boxes = np.stack([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], 1)
    keep = nms(boxes, s, iou_thr)
    boxes, s = boxes[keep], s[keep]
    # undo letterbox
    boxes[:, [0, 2]] = (boxes[:, [0, 2]] - padx) / scale
    boxes[:, [1, 3]] = (boxes[:, [1, 3]] - pady) / scale
    boxes[:, [0, 2]] = boxes[:, [0, 2]].clip(0, img_w)
    boxes[:, [1, 3]] = boxes[:, [1, 3]].clip(0, img_h)
    return boxes, s
