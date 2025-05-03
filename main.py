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
    allow_origins=["http://localhost:3000"],  # adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your YOLO model (Ensure the path is correct)
model = YOLO("best.pt")  # Make sure this is the correct path to your weights

@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    if not image.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")

    try:
        # Read image into PIL
        contents = await image.read()
        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")

        # Run YOLO
        results = model(pil_img)
        print(results)  # Debugging line to check results
        if not results or len(results) == 0:
            raise HTTPException(500, "No results returned from the model")
        result = results[0]

        # Build detections list
        detections = []
        for box in result.boxes or []:
            xyxy = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            # Use the model's own names mapping
            cls_name = model.names.get(cls_id, "Unknown")
            print(f"Detected: {cls_name} (ID: {cls_id}, Confidence: {conf})")  # Debug

            detections.append({
                "bbox": xyxy,
                "confidence": conf,
                "class_id": cls_id,
                "class_name": cls_name
            })

        # Annotate the image with bounding boxes
        annotated_bgr = result.plot()
        annotated_rgb = cv2.cvtColor(annotated_bgr, cv2.COLOR_BGR2RGB)

        # Encode to base64
        buf = io.BytesIO()
        Image.fromarray(annotated_rgb).save(buf, format="JPEG")
        img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        return JSONResponse({
            "detections": detections,
            "image": img_b64
        })

    except Exception as e:
        # Better error handling
        raise HTTPException(500, f"Error processing image: {str(e)}")
