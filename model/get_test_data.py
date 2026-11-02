"""Download the test split of the "Potholes Detection" dataset (Roboflow Universe,
project-ssayl/potholes-detection-d4rma, CC BY 4.0) from its Hugging Face mirror
(Ryukijano/Pothole-detection-Yolov8). Saves images + YOLO label files to eval_ds/.

    python get_test_data.py            # test split
    python get_test_data.py valid      # validation split
"""
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import requests

REPO = "Ryukijano/Pothole-detection-Yolov8"
split = sys.argv[1] if len(sys.argv) > 1 else "test"
out_dir = os.path.join(os.path.dirname(__file__), "eval_ds")

tree = requests.get(f"https://huggingface.co/api/datasets/{REPO}/tree/main/{split}", params={"recursive": "true"}, timeout=60).json()
files = [f["path"] for f in tree if f["type"] == "file"]
print(f"{len(files)} files in {split}")


def fetch(path):
    dest = os.path.join(out_dir, path)
    if os.path.exists(dest):
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    r = requests.get(f"https://huggingface.co/datasets/{REPO}/resolve/main/{path}", timeout=60)
    r.raise_for_status()
    with open(dest, "wb") as f:
        f.write(r.content)


with ThreadPoolExecutor(8) as ex:
    list(ex.map(fetch, files))
print("done ->", out_dir)
