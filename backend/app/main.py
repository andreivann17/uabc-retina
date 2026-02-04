"""
Entry point for the FastAPI application.

- Configura CORS y healthcheck
- Limpia modelos temporales al arrancar
- Registra routers
"""

from __future__ import annotations

import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .utils.clean_temp_models import clean_temp_models
from .routers.gptq import router as gptq_router
from .routers.detections import router as detection_router
from .routers.models import router as models_router
from .routers.ws import router as ws_router


# -------------------------------------------------
# App
# -------------------------------------------------
app = FastAPI(
    title="Legal Expedients API",
    version="1.0.0",
    openapi_url="/openapi.json",
)

# -------------------------------------------------
# Uploads
# -------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", str(DEFAULT_UPLOADS_DIR)))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# -------------------------------------------------
# CORS (abierto para desarrollo)
# -------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# Healthcheck
# -------------------------------------------------
@app.get("/healthz")
def healthz():
    return {"status": "ok"}

# -------------------------------------------------
# Startup
# -------------------------------------------------
@app.on_event("startup")
def on_startup():
    try:
        clean_temp_models()
    except Exception:
        pass

# -------------------------------------------------
# Static files
# -------------------------------------------------
app.mount("/backend/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# -------------------------------------------------
# Routers
# -------------------------------------------------
app.include_router(gptq_router)
app.include_router(models_router)
app.include_router(detection_router)
app.include_router(ws_router)
# -------------------------------------------------
# Run
# -------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    
    )
