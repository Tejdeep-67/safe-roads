"""
YOLOv8 Pothole Detection Module
"""

import os

# Model will be loaded lazily when first needed
model = None

def _load_model():
    """Lazily load the YOLOv8 model when first needed"""
    global model
    if model is None:
        try:
            from ultralytics import YOLO
            MODEL_PATH = os.getenv('YOLO_MODEL_PATH', 'models/best.pt')
            model = YOLO(MODEL_PATH)
            print("✅ YOLOv8 model loaded successfully")
        except ImportError:
            print("⚠️ ultralytics package not installed. Pothole detection will be unavailable.")
            model = False  # Mark as attempted but failed
        except Exception as e:
            print(f"⚠️ Could not load YOLOv8 model: {e}")
            model = False
    return model if model else None


def detect_pothole(image_path):
    """
    Detect pothole using YOLOv8 model
    
    Args:
        image_path (str): Path to the image file
        
    Returns:
        tuple: (pothole_detected: bool, confidence: float)
    """
    loaded_model = _load_model()
    if loaded_model is None:
        print("❌ Model not loaded")
        return False, 0.0
    
    try:
        results = loaded_model(image_path, conf=0.25)
        
        if not results or len(results) == 0:
            return False, 0.0
        
        result = results[0]
        
        # Check if detections found
        if result.boxes is None or len(result.boxes) == 0:
            return False, 0.0
        
        pothole_detected = True
        confidence = float(result.boxes.conf.mean())
        
        return pothole_detected, confidence
    
    except Exception as e:
        print(f"❌ Error during detection: {e}")
        return False, 0.0


def get_model_info():
    """Get information about the loaded model"""
    if model is None:
        return {"status": "not_loaded", "message": "YOLOv8 model not loaded"}
    
    try:
        return {
            "status": "loaded",
            "model_name": model.model_name,
            "confidence_threshold": 0.25
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
