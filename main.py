from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
from ultralytics import YOLO
import io
import base64

app = FastAPI()

# Load your YOLO model
model = YOLO("best.pt")  # Replace with actual path if needed

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")

        # Run YOLO inference
        results = model(image)
        result = results[0]  # First image result

        # Parse detections
        boxes = result.boxes
        detections = []
        if boxes is not None:
            for box in boxes:
                xyxy = box.xyxy[0].tolist()      # [x1, y1, x2, y2]
                conf = float(box.conf[0])         # confidence
                cls_id = int(box.cls[0])          # class index
                cls_name = result.names[cls_id]   # class name (e.g. 'cat', 'person')

                detections.append({
                    "bbox": xyxy,
                    "confidence": conf,
                    "class_id": cls_id,
                    "class_name": cls_name
                })

        # Annotate image
        annotated = result.plot()
        output_buffer = io.BytesIO()
        Image.fromarray(annotated).save(output_buffer, format="PNG")
        base64_image = base64.b64encode(output_buffer.getvalue()).decode("utf-8")

        return JSONResponse(content={
            "detections": detections,
            "annotated_image": base64_image
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
