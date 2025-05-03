import subprocess
import time
import os

# Start backend server
backend = subprocess.Popen(["uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"])

# Delay to ensure backend is up before frontend
time.sleep(2)

# Start frontend server (adjust path if needed)
os.chdir("frontend")
frontend = subprocess.Popen(["sudo","npm", "run", "dev"])

# Keep script running
try:
    backend.wait()
    frontend.wait()
except KeyboardInterrupt:
    backend.terminate()
    frontend.terminate()
