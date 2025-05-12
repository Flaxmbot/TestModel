# -------- Base image with Node.js and Python --------
FROM node:18-slim AS base

WORKDIR /app

# Install system-level dependencies for both Node.js and Python
RUN apt-get update && apt-get install -y ffmpeg && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# -------- Backend Setup --------
FROM base AS backend

WORKDIR /app

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
COPY main.py model.pt ./

# Copy built frontend and node modules
COPY --from=frontend /app/frontend/ ./frontend/

# Expose FastAPI port
EXPOSE 8000

# Start the FastAPI server
CMD ["python", "run_app.py"]
