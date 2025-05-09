from ultralytics import YOLO

# Load the trained model
model = YOLO("model.pt")
# Access the class names
print(model.names)
