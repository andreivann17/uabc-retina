# models/detections.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

from ..db import get_connection


# =============================
# Helpers
# =============================
def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _placeholders(n: int) -> str:
    # "%s,%s,%s"
    return ",".join(["%s"] * n)


def _safe_int(v: Any, default: int = 0) -> int:
    try:
        return int(v)
    except Exception:
        return default


# =============================
# Base list (detections only)
# =============================
def list_detections_base(*, active: Optional[int] = 1, limit: int = 200, offset: int = 0) -> Tuple[List[Dict[str, Any]], int]:
    limit = max(1, min(_safe_int(limit, 200), 1000))
    offset = max(0, _safe_int(offset, 0))

    conn = get_connection()
    try:
        with conn.cursor(dictionary=True) as cur:
            where = ""
            params: List[Any] = []
            if active is not None:
                where = "WHERE d.active=%s"
                params.append(int(active))

            # total
            cur.execute(f"SELECT COUNT(1) AS total FROM detections d {where}", tuple(params))
            total = int(cur.fetchone()["total"])

            # page
            cur.execute(
                f"""
                SELECT
                    d.id_detection,
                    d.datetime,
                    d.active,
                    d.code,
                    d.browser_name,
                    d.os_name,
                    d.os_version,
                    d.device_type,
                    d.ip_public,
                    d.img,
                    d.id_modality
                FROM detections d
                {where}
                ORDER BY d.id_detection DESC
                LIMIT %s OFFSET %s
                """,
                tuple(params + [limit, offset]),
            )
            rows = cur.fetchall()
            return rows, total
    finally:
        conn.close()


# =============================
# Aggregated cards
# =============================
def list_detections_cards(*, active: Optional[int] = 1, limit: int = 200, offset: int = 0) -> Tuple[List[Dict[str, Any]], int]:
    base_rows, total = list_detections_base(active=active, limit=limit, offset=offset)
    if not base_rows:
        return [], total

    detection_ids = [r["id_detection"] for r in base_rows]

    # 1) Modalities
    modalities_by_detection: Dict[int, List[Dict[str, Any]]] = _fetch_modalities(detection_ids)

    # 2) Models
    models_by_detection, model_ids = _fetch_models(detection_ids)

    # 3) Diseases
    diseases_by_model, disease_ids = _fetch_diseases(model_ids)

    # 4) Stages + Biomarkers
    stages_by_disease = _fetch_stages(disease_ids)
    biomarkers_by_disease = _fetch_biomarkers(disease_ids)

    # Build nested structure
    out: List[Dict[str, Any]] = []
    for d in base_rows:
        det_id = d["id_detection"]

        det_obj = {
            **d,
            "modalities": modalities_by_detection.get(det_id, []),
            "models": [],
        }

        for m in models_by_detection.get(det_id, []):
            mid = m["id_detection_model"]
            model_obj = {**m, "diseases": []}

            for dis in diseases_by_model.get(mid, []):
                did = dis["id_detection_disease"]
                disease_obj = {
                    **dis,
                    "stages": stages_by_disease.get(did, []),
                    "biomarkers": biomarkers_by_disease.get(did, []),
                }
                model_obj["diseases"].append(disease_obj)

            det_obj["models"].append(model_obj)

        out.append(det_obj)

    return out, total


def get_detection_card_by_id(*, id_detection: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute(
                """
                SELECT
                    d.id_detection,
                    d.datetime,
                    d.active,
                    d.code,
                    d.browser_name,
                    d.os_name,
                    d.os_version,
                    d.device_type,
                    d.ip_public,
                    d.img,
                    d.id_modality
                FROM detections d
                WHERE d.id_detection=%s
                LIMIT 1
                """,
                (int(id_detection),),
            )
            base = cur.fetchone()
            if not base:
                return None
    finally:
        conn.close()

    det_id = int(id_detection)

    modalities_by_detection = _fetch_modalities([det_id])
    models_by_detection, model_ids = _fetch_models([det_id])
    diseases_by_model, disease_ids = _fetch_diseases(model_ids)
    stages_by_disease = _fetch_stages(disease_ids)
    biomarkers_by_disease = _fetch_biomarkers(disease_ids)

    out = {
        **base,
        "modalities": modalities_by_detection.get(det_id, []),
        "models": [],
    }

    for m in models_by_detection.get(det_id, []):
        mid = m["id_detection_model"]
        model_obj = {**m, "diseases": []}

        for dis in diseases_by_model.get(mid, []):
            did = dis["id_detection_disease"]
            disease_obj = {
                **dis,
                "stages": stages_by_disease.get(did, []),
                "biomarkers": biomarkers_by_disease.get(did, []),
            }
            model_obj["diseases"].append(disease_obj)

        out["models"].append(model_obj)

    return out


def soft_delete_detection_by_id(*, id_detection: int) -> int:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE detections SET active=0 WHERE id_detection=%s",
                (int(id_detection),),
            )
            conn.commit()
            return cur.rowcount
    finally:
        conn.close()


# =============================
# Fetch helpers (bulk)
# =============================
def _fetch_modalities(detection_ids: List[int]) -> Dict[int, List[Dict[str, Any]]]:
    if not detection_ids:
        return {}

    conn = get_connection()
    try:
        with conn.cursor(dictionary=True) as cur:
            ph = _placeholders(len(detection_ids))
            cur.execute(
                f"""
                SELECT
                    dm.id_detection_modality,
                    dm.id_detection,
                    dm.id_modality,
                    dm.img
                FROM detection_modalities dm
                WHERE dm.id_detection IN ({ph})
                ORDER BY dm.id_detection_modality ASC
                """,
                tuple(detection_ids),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    out: Dict[int, List[Dict[str, Any]]] = {}
    for r in rows:
        out.setdefault(int(r["id_detection"]), []).append(r)
    return out


def _fetch_models(detection_ids: List[int]) -> Tuple[Dict[int, List[Dict[str, Any]]], List[int]]:
    if not detection_ids:
        return {}, []

    conn = get_connection()
    try:
        with conn.cursor(dictionary=True) as cur:
            ph = _placeholders(len(detection_ids))
            cur.execute(
                f"""
                SELECT
                    m.id_detection_model,
                    m.id_detection,
                    m.time_inference,
                    m.id_task,
                    m.id_model
                FROM detection_models m
                WHERE m.id_detection IN ({ph})
                ORDER BY m.id_detection_model ASC
                """,
                tuple(detection_ids),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    out: Dict[int, List[Dict[str, Any]]] = {}
    model_ids: List[int] = []
    for r in rows:
        did = int(r["id_detection"])
        mid = int(r["id_detection_model"])
        out.setdefault(did, []).append(r)
        model_ids.append(mid)

    return out, model_ids


def _fetch_diseases(model_ids: List[int]) -> Tuple[Dict[int, List[Dict[str, Any]]], List[int]]:
    if not model_ids:
        return {}, []

    conn = get_connection()
    try:
        with conn.cursor(dictionary=True) as cur:
            ph = _placeholders(len(model_ids))
            cur.execute(
                f"""
                SELECT
                    dd.id_detection_disease,
                    dd.score,
                    dd.label,
                    dd.summary,
                    dd.id_detection_model
                FROM detection_diseases dd
                WHERE dd.id_detection_model IN ({ph})
                ORDER BY dd.id_detection_disease ASC
                """,
                tuple(model_ids),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    out: Dict[int, List[Dict[str, Any]]] = {}
    disease_ids: List[int] = []
    for r in rows:
        mid = int(r["id_detection_model"])
        did = int(r["id_detection_disease"])
        out.setdefault(mid, []).append(r)
        disease_ids.append(did)

    return out, disease_ids


def _fetch_stages(disease_ids: List[int]) -> Dict[int, List[Dict[str, Any]]]:
    if not disease_ids:
        return {}

    conn = get_connection()
    try:
        with conn.cursor(dictionary=True) as cur:
            ph = _placeholders(len(disease_ids))
            # Nota: tu columna se llama id_detection_model_disease en detection_stages
            # y la asumimos como referencia al id_detection_disease
            cur.execute(
                f"""
                SELECT
                    ds.id_detection_stage,
                    ds.score,
                    ds.summary,
                    ds.label,
                    ds.id_detection_model,
                    ds.id_detection_model_disease
                FROM detection_stages ds
              
                WHERE ds.id_detection_model_disease IN ({ph})
                ORDER BY ds.id_detection_stage ASC
                """,
                tuple(disease_ids),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    out: Dict[int, List[Dict[str, Any]]] = {}
    for r in rows:
        key = int(r["id_detection_model_disease"])
        out.setdefault(key, []).append(r)
    return out


def _fetch_biomarkers(disease_ids: List[int]) -> Dict[int, List[Dict[str, Any]]]:
    if not disease_ids:
        return {}

    conn = get_connection()
    try:
        with conn.cursor(dictionary=True) as cur:
            ph = _placeholders(len(disease_ids))
            # Nota: tu columna se llama id_detection_model_disease en detection_biomarkers
            # y la asumimos como referencia al id_detection_disease
            cur.execute(
                f"""
                SELECT
                    db.id_detection_biomarker,
                    db.score,
                    db.label,
                    db.summary,
                    db.id_detection_model,
                    db.id_detection_model_disease
                FROM detection_biomarkers db
                WHERE db.id_detection_model_disease IN ({ph})
                ORDER BY db.id_detection_biomarker ASC
                """,
                tuple(disease_ids),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    out: Dict[int, List[Dict[str, Any]]] = {}
    for r in rows:
        key = int(r["id_detection_model_disease"])
        out.setdefault(key, []).append(r)
    return out
