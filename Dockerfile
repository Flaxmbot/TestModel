# -------- Base image with Node.js --------
  FROM node:18-slim AS base

  WORKDIR /app
  
  # -------- Backend Setup --------
  FROM python:3.11-slim AS backend
  
  WORKDIR /app
  
  # Install system-level dependencies (minimal set)
  RUN apt-get update && apt-get install -y ffmpeg && \
      apt-get clean && rm -rf /var/lib/apt/lists/*
  
  # Install Python dependencies
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  
  # -------- Frontend Build --------
  FROM base AS frontend
  
  WORKDIR /app/frontend
  
  COPY frontend/package*.json ./
  RUN npm install
  
  COPY frontend/ ./
  RUN npm run build
  
  # -------- Final Stage: Combine Frontend + Backend --------
  FROM backend AS final
  
  WORKDIR /app
  
  # Copy backend code
  COPY main.py best.pt ./
  
  # Copy built frontend and node modules
  COPY --from=frontend /app/frontend/.next ./frontend/.next
  COPY --from=frontend /app/frontend/public ./frontend/public
  COPY --from=frontend /app/frontend/node_modules ./frontend/node_modules
  
  # Optional: copy frontend source files if serving with custom routing
  COPY frontend/package.json ./frontend/
  
  # Expose FastAPI port
  EXPOSE 8000
  
  # Start the FastAPI server
  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
  