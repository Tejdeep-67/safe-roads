# Model

The detector is `backend/models/best.pt`, a **YOLOv8n-seg** model (3.26M parameters, one class: `Pothole`).
From the training arguments saved inside the checkpoint, it was fine-tuned from `yolov8n-seg.pt` at 640 px on the
Kaggle *Pothole Image Segmentation Dataset* (Ultralytics 8.0.231, Jan 2024). I did not train these weights myself;
this project is about putting the model to use (browser inference, tracking, map, route alerts).

The checkpoint also stores the validation scores from that training run (box mAP@50 0.678, mask mAP@50 0.696).
Those are the trainer's numbers on its own validation split, so I don't quote them as mine. Below are the numbers I
measured.

## Export to ONNX

```bash
pip install -r requirements.txt
python export_onnx.py      # -> public/models/pothole-yolov8n-seg.onnx (14 MB, dynamic input size)
python check_onnx.py ../public/demo/*.jpg
```

`check_onnx.py` runs the PyTorch model and the ONNX model on the same input tensor at 320/416/640 px.
The largest difference in the raw output was 0.003 (box coordinates are in pixels, so this is tiny) and the final
boxes after NMS were the same in every case.

## Evaluation on a different dataset

To get an honest number I tested on the **test split of the Roboflow "Potholes Detection" dataset**
(project-ssayl, CC BY 4.0, mirrored on Hugging Face as `Ryukijano/Pothole-detection-Yolov8`): 100 images,
269 labelled potholes. This is a different dataset from the one the model was trained on.

```bash
python get_test_data.py
python evaluate.py --model ../public/models/pothole-yolov8n-seg.onnx --data eval_ds --split test --imgsz 640
```

`evaluate.py` uses the same letterbox + NMS as the web app (my own code, not the ultralytics validator), conf 0.001 for
mAP, COCO-style 101-point AP. As a sanity check, `yolo val` with the same labels gave box mAP@50 0.333 for both
`best.pt` and the ONNX file, close to my 0.341.

| input size | mAP@50 | mAP@50-95 | precision @0.35 | recall @0.35 | CPU ms / image* |
|---|---|---|---|---|---|
| 640 | 0.341 | 0.158 | 0.676 | 0.279 | 54.9 |
| 416 | 0.363 | 0.172 | 0.717 | 0.264 | 24.2 |
| 320 | 0.340 | 0.156 | 0.724 | 0.234 | 14.2 |

\* onnxruntime (Python, CPU) on my dev machine, model only, and it was a shared machine so treat these as rough.
Browser speed depends on the device.

**What this means:** when the model says "pothole" at the default threshold it is right about 2 out of 3 times,
but it only finds about 1 in 4 of the labelled potholes in this dataset. Recall depends a lot on size (640 px input):
0.19 for small potholes (under 1% of the image, 96 of them),
0.26 for medium (1-5%) and 0.41 for large ones (over 5%).
So it is a useful "there is a pothole ahead" signal for bigger potholes but it will miss plenty, and the map relies on
several reports from different people rather than one detection. On this set 416 px even scored a little higher than 640
(the images were stretched to 640x640 by the dataset author, which may favour smaller inputs), so the web app uses
416 on devices without WebGPU. Results saved in `results/`.
