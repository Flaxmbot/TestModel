# -------- Base image with Node.js --------
    FROM node:18-bullseye-slim AS base

    WORKDIR /app
    
    # -------- Backend Dependencies --------
    FROM python:3.11-slim AS backend
    
    WORKDIR /app
    
    # Install OpenCV + rendering dependencies
    RUN apt-get update && apt-get install -y \
        libgl1-mesa-glx \
        libglib2.0-0 \
        libsm6 \
        libxrender1 \
        libxext6 \
        ffmpeg \
      && rm -rf /var/lib/apt/lists/*
    
    # Copy & install Python deps
    COPY requirements.txt .
    RUN pip install --no-cache-dir -r requirements.txt
    
    # -------- Frontend Build --------
    FROM base AS frontend
    
    WORKDIR /app/frontend
    
    COPY frontend/package*.json ./
    RUN npm install
    
    COPY frontend/ ./
    RUN npm run build
    
    # -------- Final Image Combining Both --------
    FROM backend AS final
    
    WORKDIR /app
    
    # Copy backend code + model
    COPY main.py best.pt requirements.txt ./
    COPY frontend ./frontend
    
    # Copy built frontend artifacts
    COPY --from=frontend /app/frontend/.next ./frontend/.next
    COPY --from=frontend /app/frontend/public ./frontend/public
    COPY --from=frontend /app/frontend/node_modules ./frontend/node_modules
    
    # Expose port and start FastAPI
    EXPOSE 8000
    CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
    