"""Task routes.

This router exposes AI inference endpoints that accept images and return
predictions from various models. It preserves the existing routes
provided by the user (`/diagnostic/`, `/chat-sync/`, `/chat/`) while
adding input validation and optional persistence of results. Uploaded
files are validated for size and type, saved to a dedicated
directory, processed by the model, and the results stored in the
database along with metadata.
"""

from __future__ import annotations

import io
import uuid
import datetime
from pathlib import Path
from typing import AsyncGenerator, Optional
import platform
import socket
import secrets, string, shutil, hashlib, os
from ..realtime.ws_manager import detections_manager
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Request
from fastapi.responses import JSONResponse, StreamingResponse
from PIL import Image, UnidentifiedImageError
from sqlalchemy.ext.asyncio import AsyncSession
from ..tasks import diseases_vit_onnx as object_models_diabetic
from ..tasks import fundus_cnn_onnx as object_models_fundus
from ..tasks import stages_cnn_onnx as object_models_stages
from ..tasks import biomarkers_cnn_onnx as object_models_biomarkers

# ✅ MySQL persistence (estilo get_connection)
from ..sql.models import persist_detection_from_json
_ALPHANUM = string.ascii_uppercase + string.digits
def _generate_code(n: int = 12) -> str:
    return "".join(secrets.choice(_ALPHANUM) for _ in range(n))
def _get_unique_code() -> str:
    return _generate_code(12)

router = APIRouter(tags=["tasks"])
import platform
import socket
from fastapi import Request

def _get_ip_public(request: Request) -> str:
    """
    Intenta obtener la IP real del cliente considerando proxies/CDN.
    Orden típico:
    - Cloudflare: cf-connecting-ip
    - Reverse proxy: x-forwarded-for (tomamos el primer IP)
    - Fallback: request.client.host
    """
    if not request:
        return ""

    h = request.headers

    # Cloudflare
    ip = h.get("cf-connecting-ip")
    if ip:
        return ip.strip()

    # X-Forwarded-For: "client, proxy1, proxy2"
    xff = h.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()

    # X-Real-IP
    xri = h.get("x-real-ip")
    if xri:
        return xri.strip()

    # Fallback
    try:
        return request.client.host or ""
    except Exception:
        return ""


def _detect_device_type(user_agent: str) -> str:
    ua = (user_agent or "").lower()
    if any(k in ua for k in ["postman", "insomnia", "curl", "python-requests", "httpclient", "okhttp"]):
        return "api"
    if any(k in ua for k in ["android", "iphone", "ipad", "mobile"]):
        return "mobile"
    return "desktop"


async def get_request_meta(request: Request, ip_public: str, code: str = ""):
    """
    Meta REAL del request (lo que realmente viene del cliente).
    - browser_name: se guarda el user-agent completo (es lo más útil).
    - os_name/os_version: si el cliente manda client hints, los usamos; si no, vacío.
    - device_type: heurística por user-agent.
    - hostname/os del servidor: opcional (útil para debugging). Si no lo quieres, bórralo.
    """
    h = request.headers if request else {}

    user_agent = h.get("user-agent", "")

    # Client Hints (Chrome/Edge etc). Si no existen, quedan vacíos.
    ch_platform = h.get("sec-ch-ua-platform", "").strip('"')     # e.g. "Windows"
    ch_mobile = h.get("sec-ch-ua-mobile", "")                    # "?0" o "?1"

    device_type = _detect_device_type(user_agent)
    if ch_mobile == "?1":
        device_type = "mobile"

    # Backend (servidor) real
    server_os_name = platform.system()
    server_os_version = platform.release()
    hostname = socket.gethostname()
    await detections_manager.broadcast_json({
                "type": "NEW_INFERENCE",
                "source": "models",
   
            })
  

    return {
        "code": code,
        "ip_public": ip_public,
        "browser_name": user_agent,          # REAL: user-agent completo
        "os_name": ch_platform,              # REAL si existe (si no, vacío)
        "os_version": "",                    # normalmente no viene directo; déjalo vacío
        "device_type": device_type,
        # Debug del servidor (si no lo quieres, quítalo)
        "hostname": hostname,
        "server_os_name": server_os_name,
        "server_os_version": server_os_version,
    }
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "backend/uploads/detections"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
MAX_FILE_SIZE_MB = 10


async def _read_upload_as_image(file: UploadFile) -> tuple[str, Image.Image]:
    """Validate the uploaded file and return the saved filename and PIL image.

    This helper reads the entire file into memory to check its size,
    validates its extension, attempts to open it as an image, and saves
    it to the upload directory with a unique filename. If any check
    fails, an HTTP exception is raised.
    """
    # Check extension
    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Allowed: jpg, jpeg, png")
    # Read content
    contents = await file.read()
    # Check size
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum {MAX_FILE_SIZE_MB} MB")
    # Attempt to open as image
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image")
    # Save to uploads directory with unique name
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    save_path = UPLOAD_DIR / unique_name
    with open(save_path, "wb") as f:
        f.write(contents)
    return unique_name, image


@router.post("/diagnostic/")
async def diagnostic(
    file: UploadFile = File(...),
    request: Request = None,
) -> JSONResponse:
    filename, image = await _read_upload_as_image(file)

    import time
    start = time.perf_counter()

    code = _get_unique_code()

    ip_public = _get_ip_public(request) if request else ""
    request_meta = await get_request_meta(request=request, ip_public=ip_public, code=code)

    try:
        results_diabetic = object_models_diabetic.predict_image(str(UPLOAD_DIR / filename), filename=filename)
        if results_diabetic["summary"][0] == "0":
            payload = {
                "results_diabetic": results_diabetic,
                "meta": {"duration_ms": int((time.perf_counter() - start) * 1000), "filename": filename},
            }
            persist_detection_from_json(
                filename=filename,
                id_modality=0,
                request_meta=request_meta,
                results_payload=payload,
            )
            await detections_manager.broadcast_json({
                "type": "DIAGNOSTIC_RESULT",
                "code": code,
                "payload": payload,
            })
            return JSONResponse(content=payload)

        results_stages = object_models_stages.predict_image(str(UPLOAD_DIR / filename), filename=filename)
        results_biomarkers = object_models_biomarkers.predict_image(str(UPLOAD_DIR / filename), filename=filename)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    duration_ms = int((time.perf_counter() - start) * 1000)

    payload = {
        "results_diabetic": results_diabetic,
        "results_stages": results_stages,
        "results_biomarkers": results_biomarkers,
        "meta": {"duration_ms": duration_ms, "filename": filename},
    }
    

    persist_detection_from_json(
        filename=filename,
        id_modality=0,
        request_meta=request_meta,
        results_payload=payload,
    )
    await detections_manager.broadcast_json({
        "type": "DIAGNOSTIC_RESULT",
        "code": code,
        "payload": payload,
    })
    return JSONResponse(content=payload)

