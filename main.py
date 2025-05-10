from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO
import io
import base64
import cv2

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust for your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your YOLO model
model = YOLO("model.pt")  # Make sure 'last.pt' is in the correct path
class_names = model.names  # Get class names from model

# Define the target class IDs
TARGET_CLASS_IDS = [0, 1, 2]  # Adjust based on your specific classes

@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    if not image.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")

    try:
        # Read and convert image to PIL format
        contents = await image.read()
        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")

        # Run YOLO on the image
        results = model(pil_img)
        result = results[0]  # We only sent 1 image, so use first result

        # Collect detections
        detections = {}
        for box in result.boxes:
            xyxy = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = class_names.get(cls_id, "Unknown")

            # Only keep the box with the highest confidence for each class
            if cls_id not in detections or conf > detections[cls_id]["confidence"]:
                detections[cls_id] = {
                    "bbox": xyxy,
                    "confidence": conf,
                    "class_id": cls_id,
                    "class_name": cls_name
                }

        # Convert to a list of detections
        detections = list(detections.values())

        # Draw boxes on the image
        annotated_bgr = result.plot()
        annotated_rgb = cv2.cvtColor(annotated_bgr, cv2.COLOR_BGR2RGB)

        # Encode the annotated image as base64
        buf = io.BytesIO()
        Image.fromarray(annotated_rgb).save(buf, format="JPEG")
        img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        return JSONResponse({
            "detections": detections,
            "image": img_b64
        })

    except Exception as e:
        raise HTTPException(500, f"Error processing image: {str(e)}")

@app.post("/check-missing")
async def check_missing(image: UploadFile = File(...)):
    if not image.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")

    try:
        # Read and convert image to PIL format
        contents = await image.read()
        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")

        # Run YOLO on the image
        results = model(pil_img)
        result = results[0]

        detected_ids = {int(box.cls[0]) for box in result.boxes}

        # Determine missing classes
        missing_ids = [cls_id for cls_id in TARGET_CLASS_IDS if cls_id not in detected_ids]

        warnings = []
        if missing_ids:
            warnings.append(f"Warning: Missing classes with IDs {missing_ids}")

        return JSONResponse({
            "missing_classes": missing_ids,
            "warnings": warnings
        })

    except Exception as e:
        raise HTTPException(500, f"Error processing image: {str(e)}")
