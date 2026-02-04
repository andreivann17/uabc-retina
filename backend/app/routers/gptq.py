# routes/gptq.py
from __future__ import annotations

import inspect
import json
import os
import re
import subprocess
import uuid
import sys

from collections import deque
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from ..gptq.stream import GPTQStream
from ..gptq.llama import run_llama_gptq
from ..gptq.snapshots import get_snapshot, save_snapshot
from ..gptq.tiles import extract_tile
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, field_validator
from fastapi.responses import StreamingResponse
import threading
router = APIRouter(prefix="/gptq", tags=["gptq"])


# ============================================================
# Helpers: respuestas consistentes para el frontend
# ============================================================
def ok(message: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"ok": True, "message": message, "data": data or {}}


def fail(
    message: str,
    *,
    code: str = "VALIDATION_ERROR",
    http_status: int = status.HTTP_422_UNPROCESSABLE_ENTITY,
    data: Optional[Dict[str, Any]] = None,
) -> None:
    raise HTTPException(
        status_code=http_status,
        detail={"ok": False, "code": code, "message": message, "data": data or {}},
    )


# ============================================================
# Schemas
# ============================================================
class GPTQRequest(BaseModel):
    model_path: str
    wbits: int = 4
    nsamples: int = 32
    csv_path: Optional[str] = None
    save_path: Optional[str] = None
    forced_family: Optional[str] = None  # "llama" | "mistral" | "deepseek" | "gpt" | None

    model_config = ConfigDict(extra="allow")

    @field_validator("model_path", "csv_path", "save_path", "forced_family", mode="before")
    @classmethod
    def _strip(cls, v):
        if v is None:
            return v
        if not isinstance(v, str):
            return v
        return v.strip()

    @field_validator("wbits")
    @classmethod
    def _wbits(cls, v):
        v = int(v)
        if v not in (2, 3, 4, 8):
            raise ValueError("wbits inválido. Usa 2, 3, 4 u 8.")
        return v

    @field_validator("nsamples")
    @classmethod
    def _nsamples(cls, v):
        v = int(v)
        if v <= 0:
            raise ValueError("nsamples debe ser mayor a 0.")
        return v


# ============================================================
# Detección de “tipo/familia” de modelo (HF)
# ============================================================
ALLOWED_FAMILIES = {"llama", "mistral", "deepseek", "gpt"}

FAMILY_ALIASES = {
    "llama": {"llama", "llama2", "llama-2", "llama3", "llama-3"},
    "mistral": {"mistral", "mixtral"},
    "deepseek": {"deepseek", "deepseek_v2", "deepseek-v2", "deepseek_v3", "deepseek-v3"},
    "gpt": {"gpt", "gpt2", "gpt_neo", "gpt-neox", "gptj", "gpt-j"},
}


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _looks_like_hf_model_dir(model_dir: Path) -> Tuple[bool, str]:
    if not model_dir.exists():
        return False, "La ruta no existe."
    if not model_dir.is_dir():
        return False, "La ruta debe ser un directorio (carpeta) del modelo."

    config = model_dir / "config.json"
    if not config.exists():
        return False, "No se encontró config.json. Esa carpeta no parece un modelo compatible."

    weight_patterns = ["*.safetensors", "pytorch_model*.bin", "*.bin", "*.pt"]
    has_weights = any(model_dir.glob(pat) for pat in weight_patterns)
    if not has_weights:
        return False, "No se encontraron archivos de pesos (.safetensors/.bin/.pt) en la carpeta del modelo."

    return True, ""


def _normalize_family_from_model_type(model_type: str) -> Optional[str]:
    mt = (model_type or "").lower().strip()
    mt = re.sub(r"[^a-z0-9_\-]+", "", mt)

    for fam, aliases in FAMILY_ALIASES.items():
        if mt == fam or mt in aliases:
            return fam
        if any(a in mt for a in aliases):
            return fam
    return None


def detect_model_family(model_dir: Path, forced_family: Optional[str] = None) -> Dict[str, Any]:
    if forced_family:
        fam = forced_family.lower().strip()
        if fam not in ALLOWED_FAMILIES:
            return {"family": None, "reason": f"forced_family inválido: {forced_family}"}
        return {"family": fam, "reason": "forced_family"}

    cfg = _read_json(model_dir / "config.json") or {}

    model_type = str(cfg.get("model_type") or "")
    fam = _normalize_family_from_model_type(model_type)
    if fam:
        return {"family": fam, "reason": f"config.model_type={model_type}"}

    arch = cfg.get("architectures")
    if isinstance(arch, list) and arch:
        arch0 = str(arch[0]).lower()
        fam = _normalize_family_from_model_type(arch0) or (
            "llama" if "llama" in arch0 else
            "mistral" if "mistral" in arch0 or "mixtral" in arch0 else
            "deepseek" if "deepseek" in arch0 else
            "gpt" if "gpt" in arch0 else
            None
        )
        if fam:
            return {"family": fam, "reason": f"config.architectures[0]={arch0}"}

    name = model_dir.name.lower()
    fam = (
        "llama" if "llama" in name else
        "mistral" if "mistral" in name or "mixtral" in name else
        "deepseek" if "deepseek" in name else
        "gpt" if "gpt" in name else
        None
    )
    if fam:
        return {"family": fam, "reason": f"folder_name={model_dir.name}"}

    return {"family": None, "reason": "No se pudo inferir la familia del modelo."}


# ============================================================
# Util: resolver salida y asegurar carpetas
# ============================================================
def _resolve_save_path(model_dir: Path, save_path: Optional[str], wbits: int) -> Path:
    if save_path:
        sp = Path(save_path)
        # si viene relativo, lo guardamos dentro del model_dir por defecto
        if not sp.is_absolute():
            sp = model_dir / sp
        sp.parent.mkdir(parents=True, exist_ok=True)
        return sp

    default_out = model_dir / f"gptq_w{wbits}.pt"
    default_out.parent.mkdir(parents=True, exist_ok=True)
    return default_out

# ============================================================
# GPTQ runners (separados)
# ============================================================
def run_gptq_llama(payload: GPTQRequest, model_dir: Path) -> Dict[str, Any]:
    if not payload.csv_path:
        fail("Falta csv_path (set de calibración).", code="MISSING_CSV")

    csv_path = Path(payload.csv_path)
    if not csv_path.exists() or not csv_path.is_file():
        fail(
            "csv_path no existe o no es un archivo.",
            code="INVALID_CSV_PATH",
            data={"csv_path": str(csv_path)},
        )

    save_path = _resolve_save_path(model_dir, payload.save_path, payload.wbits)

    cmd = [
        sys.executable,
        "-m",
        "app.gptq.llama",
        str(model_dir),
        "custom_csv",
        "--csv_path",
        str(csv_path),
        "--wbits",
        str(payload.wbits),
        "--nsamples",
        str(payload.nsamples),
        "--save",
        str(save_path),
    ]

    job_id = str(uuid.uuid4())

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env["TRANSFORMERS_NO_TF"] = "1"
    env["TRANSFORMERS_NO_FLAX"] = "1"
    env["USE_TF"] = "0"

    tail_lines: deque[str] = deque(maxlen=300)

    try:
        backend_root = Path(__file__).resolve().parents[2]  # .../backend

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
            cwd=str(backend_root),
        )

        assert proc.stdout is not None
        for line in proc.stdout:
            print(line, end="")
            tail_lines.append(line.rstrip("\n"))

        returncode = proc.wait()

    except Exception as e:
        fail(
            "Error al ejecutar el proceso de cuantización.",
            code="EXEC_ERROR",
            http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            data={"job_id": job_id, "error": str(e), "cmd": cmd},
        )

    if returncode != 0:
        fail(
            "La cuantización falló. Revisa logs.",
            code="GPTQ_FAILED",
            http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            data={
                "job_id": job_id,
                "returncode": returncode,
                "log_tail": "\n".join(tail_lines)[-8000:],
                "cmd": cmd,
            },
        )

    return ok(
        "Cuantización completada.",
        data={
            "job_id": job_id,
            "family": "llama",
            "model_path": str(model_dir),
            "csv_path": str(csv_path),
            "save_path": str(save_path),
            "log_tail": "\n".join(tail_lines)[-8000:],
        },
    )

def run_gptq_other(payload: GPTQRequest, model_dir: Path, family: str) -> Dict[str, Any]:
    return ok(
        "Modelo válido. Ruta lista para cuantización en el runner de la familia indicada.",
        data={
            "family": family,
            "model_path": str(model_dir),
            "note": "Implementa aquí tu runner específico (script/comando) para esta familia.",
        },
    )


# ============================================================
# Endpoint
# ============================================================
@router.post("", status_code=status.HTTP_201_CREATED, summary="GPTQ Quantization (por ruta local)")
def gptq_quantize(payload: GPTQRequest) -> Dict[str, Any]:
    if not payload.model_path:
        fail("Falta model_path.", code="MISSING_MODEL_PATH")

    model_dir = Path(payload.model_path)

    exists_ok, reason = _looks_like_hf_model_dir(model_dir)
    if not exists_ok:
        fail(reason, code="INVALID_MODEL_PATH", data={"model_path": str(model_dir)})

    fam_info = detect_model_family(model_dir, forced_family=payload.forced_family)
    family = fam_info.get("family")

    if not family:
        fail(
            "No se pudo detectar el tipo de modelo. Asegúrate que sea compatible y que config.json tenga model_type.",
            code="UNKNOWN_MODEL_FAMILY",
            data={"reason": fam_info.get("reason"), "allowed": sorted(ALLOWED_FAMILIES)},
        )

    if family not in ALLOWED_FAMILIES:
        fail(
            "Modelo no soportado para este endpoint GPTQ.",
            code="UNSUPPORTED_MODEL",
            data={"detected": family, "allowed": sorted(ALLOWED_FAMILIES)},
        )

    if family == "llama":
        return run_gptq_llama(payload, model_dir)

    return run_gptq_other(payload, model_dir, family)

STREAMS = {}

@router.post("/run")
def run_gptq(payload: GPTQRequest):
    job_id = str(uuid.uuid4())
    stream = GPTQStream()
    STREAMS[job_id] = stream

    # ============================================================
    # DESPUÉS (app/routers/gptq.py)  -- CIERRE SEGURO
    # ============================================================
    def job():
        try:
            stream.emit({"type": "status", "message": "job_started", "job_id": job_id})
            run_llama_gptq(
                model_path=payload.model_path,
                csv_path=payload.csv_path,
                wbits=payload.wbits,
                nsamples=payload.nsamples,
                save_path=payload.save_path,
                stream=stream,
                job_id=job_id,
            )
            stream.emit({"type": "status", "message": "job_finished", "job_id": job_id})
        except Exception as e:
            stream.emit({"type": "error", "message": str(e), "job_id": job_id})
            raise
        finally:
            stream.close()



    threading.Thread(target=job, daemon=True).start()

    return {
        "job_id": job_id,
        "stream_url": f"/gptq/stream/{job_id}"
    }

@router.get("/stream/{job_id}")
def gptq_stream(job_id: str):
    stream = STREAMS.get(job_id)
    if not stream:
        raise HTTPException(
            status_code=404,
            detail={"ok": False, "code": "JOB_NOT_FOUND", "message": "job_id no existe."},
        )

    return StreamingResponse(
        stream.generator(keepalive_sec=3),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/tile")
def get_tile(job_id: str, key: str, row: int, col: int):
    tensor = get_snapshot(job_id, key)
    if tensor is None:
        fail("Snapshot no disponible")

    tile = extract_tile(tensor, row=row, col=col)
    return {"tile": tile}

