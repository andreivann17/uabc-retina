# routes/detections.py
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, field_validator

from ..sql import detections as detections_model

router = APIRouter(prefix="/detections", tags=["detections"])


# =============================
# Schemas (solo para filtros opcionales)
# =============================
class DetectionListQuery(BaseModel):
    active: Optional[int] = 1
    limit: Optional[int] = 200
    offset: Optional[int] = 0
    model_config = ConfigDict(extra="ignore")

    @field_validator("active", "limit", "offset")
    @classmethod
    def _to_int(cls, v):
        if v is None:
            return v
        return int(v)


# =============================
# Endpoints
# =============================
@router.get("", summary="Listado de detections (base)")
def list_detections(
    q: DetectionListQuery = Depends(),
) -> Dict[str, Any]:
    items, total = detections_model.list_detections_base(
        active=q.active,
        limit=q.limit,
        offset=q.offset,
    )
    return {"items": items, "count": len(items), "total": total}


@router.get("/cards", summary="Cards de detections (agregado completo)")
def list_detections_cards(
    q: DetectionListQuery = Depends(),
) -> Dict[str, Any]:
    items, total = detections_model.list_detections_cards(
        active=q.active,
        limit=q.limit,
        offset=q.offset,
    )
    return {"items": items, "count": len(items), "total": total}


@router.get("/{id_detection}", summary="Obtener detection por id (agregado completo)")
def get_detection_by_id(
    id_detection: int,
) -> Dict[str, Any]:
    row = detections_model.get_detection_card_by_id(id_detection=id_detection)
    if not row:
        raise HTTPException(status_code=404, detail="Detection no encontrada")
    return row


@router.delete("/{id_detection}", summary="Eliminar (soft delete) detection por id")
def delete_detection_by_id(
    id_detection: int,
) -> Dict[str, Any]:
    updated = detections_model.soft_delete_detection_by_id(id_detection=id_detection)
    if updated == 0:
        raise HTTPException(status_code=404, detail="Detection no encontrada")
    return {"deleted": updated}
