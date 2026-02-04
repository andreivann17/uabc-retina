# scripts/import_estados_ciudades_desde_json.py
import json
from typing import Dict, List, Optional, Tuple

# Usa tu conexión real (igual que tu script de empresas)
from app.db import get_connection  # ajusta si tu path es distinto


JSON_PATH = r"c:\Users\andre\Downloads\estados-municipios.json"

# Si quieres, puedes setear defaults (si no, se insertan NULL)
DEFAULT_ESTADO_IMG: Optional[str] = None          # ejemplo: "mx/estados/aguascalientes.png"
DEFAULT_CIUDAD_IMG: Optional[str] = None          # ejemplo: "mx/ciudades/aguascalientes.png"
DEFAULT_CIUDAD_COLOR_HEX: Optional[str] = None    # ejemplo: "#1E90FF"

ACTIVE_DEFAULT = 1


def load_json(path: str) -> Dict[str, List[str]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, dict):
        raise RuntimeError("El JSON debe ser un objeto: { 'Estado': ['Ciudad', ...], ... }")

    clean: Dict[str, List[str]] = {}
    for k, v in data.items():
        if not isinstance(k, str) or not k.strip():
            continue
        if not isinstance(v, list):
            continue
        estado = k.strip()
        ciudades = []
        for c in v:
            if isinstance(c, str) and c.strip():
                ciudades.append(c.strip())
        if ciudades:
            clean[estado] = ciudades

    if not clean:
        raise RuntimeError("JSON vacío o inválido (no hay estados/ciudades válidos).")

    return clean


def import_estados_ciudades():
    data = load_json(JSON_PATH)

    conn = get_connection()
    try:
        conn.start_transaction()
        with conn.cursor() as cur:
            # =========================
            # 1) Estados (upsert por nombre)
            # =========================
            sql_estado_upsert = """
                INSERT INTO estados (nombre, active, img)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    active = VALUES(active),
                    img = COALESCE(VALUES(img), img)
            """

            # si NO tienes UNIQUE(nombre) en estados, usa este SELECT/INSERT (más abajo)
            sql_estado_select = "SELECT id_estado FROM estados WHERE nombre = %s LIMIT 1"
            sql_estado_insert = """
                INSERT INTO estados (nombre, active, img)
                VALUES (%s, %s, %s)
            """

            estados_ids: Dict[str, int] = {}

            for estado in sorted(data.keys()):
                estado_img = DEFAULT_ESTADO_IMG  # si luego quieres mapear por estado, cambia aquí

                # --- intenta upsert (requiere UNIQUE(nombre))
                try:
                    cur.execute(sql_estado_upsert, (estado, ACTIVE_DEFAULT, estado_img))
                    # obtener id (si fue insert o update)
                    cur.execute(sql_estado_select, (estado,))
                    row = cur.fetchone()
                    if not row:
                        raise RuntimeError(f"No se pudo leer id_estado para '{estado}'")
                    estados_ids[estado] = int(row[0])
                except Exception:
                    # fallback sin UNIQUE: busca y si no existe inserta
                    cur.execute(sql_estado_select, (estado,))
                    row = cur.fetchone()
                    if row:
                        estados_ids[estado] = int(row[0])
                    else:
                        cur.execute(sql_estado_insert, (estado, ACTIVE_DEFAULT, estado_img))
                        estados_ids[estado] = int(cur.lastrowid)

            # =========================
            # 2) Ciudades (insert ignorando duplicados por (id_estado, nombre))
            # =========================
            # Recomendado: UNIQUE(id_estado, nombre) en ciudades
            sql_ciudad_upsert = """
                INSERT INTO ciudades (nombre, active, id_estado, img, color_hex)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    active = VALUES(active),
                    img = COALESCE(VALUES(img), img),
                    color_hex = COALESCE(VALUES(color_hex), color_hex)
            """

            # fallback sin UNIQUE: SELECT antes de INSERT
            sql_ciudad_select = """
                SELECT id_ciudad
                FROM ciudades
                WHERE id_estado = %s AND nombre = %s
                LIMIT 1
            """
            sql_ciudad_insert = """
                INSERT INTO ciudades (nombre, active, id_estado, img, color_hex)
                VALUES (%s, %s, %s, %s, %s)
            """
            sql_ciudad_update = """
                UPDATE ciudades
                SET active = %s,
                    img = COALESCE(%s, img),
                    color_hex = COALESCE(%s, color_hex)
                WHERE id_ciudad = %s
            """

            for estado, ciudades in data.items():
                id_estado = estados_ids.get(estado)
                if not id_estado:
                    raise RuntimeError(f"No existe id_estado para '{estado}'")

                for ciudad in ciudades:
                    ciudad_img = DEFAULT_CIUDAD_IMG
                    ciudad_color = DEFAULT_CIUDAD_COLOR_HEX

                    try:
                        cur.execute(
                            sql_ciudad_upsert,
                            (ciudad, ACTIVE_DEFAULT, id_estado, ciudad_img, ciudad_color),
                        )
                    except Exception:
                        # fallback sin UNIQUE
                        cur.execute(sql_ciudad_select, (id_estado, ciudad))
                        row = cur.fetchone()
                        if row:
                            id_ciudad = int(row[0])
                            cur.execute(
                                sql_ciudad_update,
                                (ACTIVE_DEFAULT, ciudad_img, ciudad_color, id_ciudad),
                            )
                        else:
                            cur.execute(
                                sql_ciudad_insert,
                                (ciudad, ACTIVE_DEFAULT, id_estado, ciudad_img, ciudad_color),
                            )

        conn.commit()
        print("Importación terminada correctamente.")
    except Exception as e:
        conn.rollback()
        print("Error durante la importación:", e)
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    import_estados_ciudades()
