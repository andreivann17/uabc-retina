# models/detections_flow.py
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple, List
from datetime import datetime

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

import io
import uuid
from pathlib import Path
from collections.abc import Mapping, Sequence
import json
from ..db import get_connection

# =============================
# Config
# =============================
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "backend/uploads/detections"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
MAX_FILE_SIZE_MB = 10

def _label(v: Any, *, max_len: int = 255) -> str:
    if v is None:
        return "N/A"

    # lista/dict -> JSON string (MySQL sí lo acepta como VARCHAR/TEXT)
    if isinstance(v, (dict, list, tuple)):
        return json.dumps(v, ensure_ascii=False)[:max_len]

    return str(v)[:max_len]

# =============================
# File helpers
# =============================
def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _s10(v: Any) -> str:
    s = str(v if v is not None else "0")
    return s[:10]


def _s25(v: Any) -> str:
    s = str(v if v is not None else "0")
    return s[:25]


async def save_upload_and_get_image(file: UploadFile) -> Tuple[str, Image.Image]:
    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Allowed: jpg, jpeg, png")

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum {MAX_FILE_SIZE_MB} MB")

    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image")

    filename = f"{uuid.uuid4().hex}.{ext}"
    save_path = UPLOAD_DIR+"/detection" / filename
    with open(save_path, "wb") as f:
        f.write(contents)

    return filename, image


# =============================
# Core persistence flow (MySQL)
# =============================
def persist_detection_from_json(
    *,
    filename: str,
    id_modality: int = 1,
    request_meta: Optional[Dict[str, Any]] = None,
    results_payload: Dict[str, Any],
) -> int:
    print(results_payload)
    print("----")
    """
    Guarda el flujo completo en BD usando mysql2-style connection (get_connection).

    Inserta en:
      - detections
      - detection_modalities
      - detection_models (una fila por bloque de inferencia presente)
      - detection_diseases (tabla puente requerida)
      - detection_stages
      - detection_biomarkers

    Devuelve: id_detection
    """

    request_meta = request_meta or {}

    # ------------------------------------------------------------------
    # Reglas / IDs de tasks (ajusta a tu catálogo)
    # ------------------------------------------------------------------
    TASK_RETINA = 1
    TASK_DIABETIC = 2
    TASK_STAGES = 3
    TASK_BIOMARKERS = 4
    ID_MODEL_RETINA = 1
    ID_MODEL_DIABETIC = 2
    ID_MODEL_STAGES = 3
    ID_MODEL_BIOMARKERS = 4
    # ------------------------------------------------------------------
    # Helper: server_type desde device
    # ------------------------------------------------------------------
    def _server_type(device: str) -> int:
        return 2 if (device or "").upper() == "GPU" else 1

    # ------------------------------------------------------------------
    # Helper: inserta detection_models
    # ------------------------------------------------------------------
    def _insert_detection_model(cur, *, id_detection: int, task_id: int, block: Dict[str, Any],id_model) -> int:
        cur.execute(
            """
            INSERT INTO detection_models
                (id_detection, time_inference, id_task, id_model)
            VALUES
                (%s, %s,  %s, %s)
            """,
            (
                id_detection,
                _s10(block.get("time_inference", 0)),
                task_id,
               id_model,
            ),
        )
        return cur.lastrowid

    # ------------------------------------------------------------------
    # Helper: calcula índice predicho (NO usar id_retina/id_disease porque
    # en tu JSON no coincide con el tamaño del vector)
    # ------------------------------------------------------------------
    def _pick_pred_index(summary: List[Any], vector_probs: List[Any]) -> int:
        # 1) si summary trae un "1", ese es el predicho
        try:
            for i, v in enumerate(summary or []):
                if str(v) == "1" or int(v) == 1:
                    return i
        except Exception:
            pass

        # 2) si no, argmax de vector_probs
        best_i, best_v = 0, None
        for i, p in enumerate(vector_probs or []):
            try:
                fp = float(p)
            except Exception:
                fp = 0.0
            if best_v is None or fp > best_v:
                best_v = fp
                best_i = i
        return best_i

    # ------------------------------------------------------------------
    # Helper: inserta vector tipo "diseases" en detection_diseases
    # CORRECCIÓN: id_model_disease debe ser ID REAL (id_disease/id_retina),
    # NO el índice.
    # ------------------------------------------------------------------
    def _insert_model_diseases_vector(
        cur,
        *,
        id_detection_model: int,
        summary: List[Any],
        vector_probs: List[Any],
        items: List[Dict[str, Any]],  # <- retina o diseases (con name)
    ) -> Tuple[int, List[int]]:
        ids: List[int] = []
        for i, s in enumerate(summary or []):
            prob = vector_probs[i] if i < len(vector_probs or []) else 0
            row_label = items[i].get("name") if i < len(items) else f"cls_{i}"

            cur.execute(
                """
                INSERT INTO detection_diseases
                    (id_detection_model, score, summary, label)
                VALUES
                    (%s, %s, %s, %s)
                """,
                (
                    id_detection_model,
                    _s25(prob),
                    int(s),
                    _label(row_label),
                ),
            )
            ids.append(cur.lastrowid)

        return (ids[0] if ids else 0), ids

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # ============================================================
            # 1) detections
            # ============================================================
            cur.execute(
                """
                INSERT INTO detections
                    (datetime, active, code, browser_name, os_name, os_version, device_type, ip_public, img, id_modality)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    _now(),
                    1,
                    str(request_meta.get("code", "") or ""),
                    str(request_meta.get("browser_name", "") or ""),
                    str(request_meta.get("os_name", "") or ""),
                    str(request_meta.get("os_version", "") or ""),
                    str(request_meta.get("device_type", "") or ""),
                    str(request_meta.get("ip_public", "") or ""),
                    filename,
                    int(id_modality or 1),
                ),
            )
            id_detection = cur.lastrowid

            # ============================================================
            # 2) detection_modalities
            # ============================================================
            cur.execute(
                """
                INSERT INTO detection_modalities (id_detection, id_modality, img)
                VALUES (%s, %s, %s)
                """,
                (id_detection, int(id_modality or 1), filename),
            )

            # ============================================================
            # 3) Persist blocks
            # ============================================================
            retina_anchor_dmd: Optional[int] = None
            diabetic_anchor_dmd: Optional[int] = None
            anchor_dmd_for_children: Optional[int] = None

            # ---------- results_retina ----------
            rr = results_payload.get("results_retina") or {}
            rd = results_payload.get("results_diabetic") or {}
            rs = results_payload.get("results_stages") or {}
            rb = results_payload.get("results_biomarkers") or {}

            results_labels = {
                "results_retina": _label(rr.get("predicted_label")),
                "results_diabetic": _label(rd.get("predicted_label")),
                "results_stages": _label(rs.get("predicted_label")),
                "results_biomarkers": _label(rb.get("predicted_labels")),  # <- aquí estaba la lista
            }

            if "results_retina" in results_payload:
                r = results_payload["results_retina"]
                id_dm_retina = _insert_detection_model(cur, id_detection=id_detection, task_id=TASK_RETINA,id_model=ID_MODEL_RETINA, block=r)

                # IDs reales para retina (en el mismo orden del vector)
                retina_items = r.get("retina", []) or []
                retina_model_ids = []
                for it in retina_items:
                    try:
                        retina_model_ids.append(int(it.get("id_retina")))
                    except Exception:
                        retina_model_ids.append(None)

                # si por algo no viene "retina", fallback a longitud del summary
                if not retina_model_ids:
                    retina_model_ids = list(range(len(r.get("summary", []) or [])))

                retina_items = r.get("retina", []) or []

                _, ids_dmd = _insert_model_diseases_vector(
                    cur,
                    id_detection_model=id_dm_retina,
                    summary=r.get("summary", []) or [],
                    vector_probs=r.get("vector_probs", []) or [],
                    items=retina_items,
                )


                pred_idx = _pick_pred_index(r.get("summary", []) or [], r.get("vector_probs", []) or [])
                if ids_dmd and 0 <= pred_idx < len(ids_dmd):
                    retina_anchor_dmd = ids_dmd[pred_idx]
                elif ids_dmd:
                    retina_anchor_dmd = ids_dmd[0]

            # ---------- results_diabetic ----------
            if "results_diabetic" in results_payload:
                d = results_payload["results_diabetic"]
                id_dm_diabetic = _insert_detection_model(cur, id_detection=id_detection, task_id=TASK_DIABETIC, id_model=ID_MODEL_DIABETIC,block=d)

                # IDs reales para diseases (en el mismo orden del vector)
                disease_items = d.get("diseases", []) or []
                disease_model_ids = []
                for it in disease_items:
                    try:
                        disease_model_ids.append(int(it.get("id_disease")))
                    except Exception:
                        disease_model_ids.append(None)

                if not disease_model_ids:
                    disease_model_ids = list(range(len(d.get("summary", []) or [])))

                disease_items = d.get("diseases", []) or []

                _, ids_dmd = _insert_model_diseases_vector(
                    cur,
                    id_detection_model=id_dm_diabetic,
                    summary=d.get("summary", []) or [],
                    vector_probs=d.get("vector_probs", []) or [],
                    items=disease_items,
                )


                pred_idx = _pick_pred_index(d.get("summary", []) or [], d.get("vector_probs", []) or [])
                if ids_dmd and 0 <= pred_idx < len(ids_dmd):
                    diabetic_anchor_dmd = ids_dmd[pred_idx]
                elif ids_dmd:
                    diabetic_anchor_dmd = ids_dmd[0]

            # Anchor para stages/biomarkers:
            anchor_dmd_for_children = diabetic_anchor_dmd or retina_anchor_dmd

            # ---------- results_stages ----------
            if "results_stages" in results_payload:
                s = results_payload["results_stages"]
                id_dm_stages = _insert_detection_model(cur, id_detection=id_detection, task_id=TASK_STAGES, id_model=ID_MODEL_STAGES,block=s)

                # Si no hay anchor previo, creamos uno mínimo (porque FK es NOT NULL)
                if not anchor_dmd_for_children:
                    # aquí id_model_disease lo dejamos como el id_stages real si existe, si no índice
                    stage_items = s.get("stages", []) or []
                    fallback_id = int(stage_items[0].get("id_stages")) if stage_items else int(s.get("id_stages", 0) or 0)
                    
                   
                    cur.execute(
                        """
                        INSERT INTO detection_diseases (id_detection_model , score, summary,label)
                        VALUES (%s,  %s, %s,%s)
                        """,
                        (id_dm_stages, "0", 1,"ANCHOR"),
                    )
                    anchor_dmd_for_children = cur.lastrowid

                # CORRECCIÓN: id_model_stage debe ser ID real (id_stages) en el orden del vector
                stage_items = s.get("stages", []) or []
                stage_model_ids = []
                for it in stage_items:
                    try:
                        stage_model_ids.append(int(it.get("id_stages")))
                    except Exception:
                        stage_model_ids.append(None)

                summary = s.get("summary", []) or []
                probs = s.get("vector_probs", []) or []

                stage_items = s.get("stages", []) or []

                for i, flag in enumerate(summary):
                    score = probs[i] if i < len(probs) else 0
                    row_label = stage_items[i].get("name") if i < len(stage_items) else f"stage_{i}"

                    cur.execute(
                        """
                        INSERT INTO detection_stages
                            (score, summary, id_detection_model, id_detection_model_disease, label)
                        VALUES
                            (%s, %s, %s, %s, %s)
                        """,
                        (
                            _s25(score),
                            int(flag),
                            id_dm_stages,
                            int(anchor_dmd_for_children),
                            _label(row_label),
                        ),
                    )


            # ---------- results_biomarkers ----------
            if "results_biomarkers" in results_payload:
                b = results_payload["results_biomarkers"]
                id_dm_biomarkers = _insert_detection_model(cur, id_detection=id_detection, task_id=TASK_BIOMARKERS,id_model=ID_MODEL_BIOMARKERS, block=b)

                if not anchor_dmd_for_children:
                    cur.execute(
                        """
                        INSERT INTO detection_diseases (id_detection_model, score, summary,label)
                        VALUES (%s, %s, %s,%s)
                        """,
                        (id_dm_biomarkers,  "0", 1,results_labels.get("results_diseases", "N/A") or "N/A"),
                    )
                    anchor_dmd_for_children = cur.lastrowid

                # CORRECCIÓN: id_model_biomarker debe ser ID real (id_biomarker) en el orden del vector
                biom_items = b.get("biomarkers", []) or []
                biom_model_ids = []
                for it in biom_items:
                    try:
                        biom_model_ids.append(int(it.get("id_biomarker")))
                    except Exception:
                        biom_model_ids.append(None)

                summary = b.get("summary", []) or []
                probs = b.get("vector_probs", []) or []
                pred_biomarkers = results_payload["results_biomarkers"].get("biomarker_names", [])
          


                for i, flag in enumerate(summary):
                    score = probs[i] if i < len(probs) else 0
                    real_biom_id = biom_model_ids[i] if i < len(biom_model_ids) else i
                    try:
                        real_biom_id = int(real_biom_id)
                    except Exception:
                        real_biom_id = i

                    cur.execute(
                        """
                        INSERT INTO detection_biomarkers
                            (score, summary, id_detection_model, id_detection_model_disease,label)
                        VALUES
                            (%s, %s, %s, %s,%s)
                        """,
                        (
                            _s25(score),
                            int(flag),
                            id_dm_biomarkers,
                            int(anchor_dmd_for_children),
                          pred_biomarkers[i],

                          
                        ),
                    )

            conn.commit()
            return id_detection

    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise e
    finally:
        conn.close()
