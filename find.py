from ultralytics import YOLO

# Load the trained model
model = YOLO("last.pt")
# Access the class names
print(model.names)
