# -------------------- Base Node.js Image --------------------
FROM node:18-slim AS base-node
WORKDIR /app

# -------------------- Frontend Build Stage --------------------
FROM base-node AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# -------------------- Python Backend Stage --------------------
FROM python:3.11-slim AS backend
WORKDIR /app

# Install system-level dependencies (only essential ones)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY backend/ .

# Copy frontend build to backend
COPY --from=frontend /app/frontend/build ./frontend/build

# Environment variables
ENV PORT=8080

# Expose the port
EXPOSE 8000

# Use a non-root user
RUN useradd -m appuser
USER appuser

# Start the backend server
CMD ["python", "run_app.py"]
