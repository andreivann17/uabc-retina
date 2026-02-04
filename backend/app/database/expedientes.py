# app/db/expedientes.py
import os
import pandas as pd
import mysql.connector
from mysql.connector import pooling
import unicodedata

DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "",
    "database": "ontiveros",
}

# --- util: normalizar encabezados (minúsculas, _ y sin acentos)
def _norm(s: str) -> str:
    s = str(s).strip().lower().replace(" ", "_")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s

# Mapeo de sinónimos -> nombre esperado en BD
ALIAS_MAP = {
    # Excel -> BD
    "año": "anual",
    "anio": "anual",
    "ano": "anual",
    # otros posibles alias/acentos
    "específico": "especifico",
    "estatus_": "estatus",
    "comentarios": "status",  # si alguna vez lo nombran distinto
}

EXPECTED = [
    "exp", "anual", "actor", "empresa", "estatus",
    "especifico", "abogado", "ciudad", "status", "total_asuntos"
]

def import_excel_to_db(filepath: str):
    """
    Lee Excel/CSV, mapea encabezados (Año -> anual), valida columnas
    y realiza INSERT en tabla `expediente` evitando duplicados por `exp`.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"No existe el archivo: {filepath}")

    ext = os.path.splitext(filepath)[1].lower()
    if ext not in (".xlsx", ".xls", ".csv"):
        raise ValueError("Formato no soportado. Use .xlsx, .xls o .csv")

    # Leer a DataFrame
    if ext == ".csv":
        # intenta utf-8 y fallback a latin-1
        try:
            df = pd.read_csv(filepath)
        except UnicodeDecodeError:
            df = pd.read_csv(filepath, encoding="latin-1")
    else:
        df = pd.read_excel(filepath, engine="openpyxl")

    # Normalizar y mapear encabezados
    original_cols = list(df.columns)
    norm_cols = [_norm(c) for c in original_cols]
    df.columns = norm_cols
    # aplicar alias explícitos
    df.rename(columns={k: v for k, v in ALIAS_MAP.items() if k in df.columns}, inplace=True)

    # Validación de columnas requeridas (después del mapeo)
    missing = [col for col in EXPECTED if col not in df.columns]
    if missing:
        raise ValueError(
            f"Columnas faltantes: {missing}. Encabezados recibidos (normalizados): {list(df.columns)}"
        )

    # Limpieza básica
    df = df.fillna("")
    # Casts razonables
    for num_col in ("exp", "anual", "total_asuntos"):
        if num_col in df.columns:
            # tolerante a strings vacíos
            df[num_col] = df[num_col].apply(lambda x: "" if str(x).strip()=="" else str(x).split(".")[0])

    # Conexión pool
    pool = pooling.MySQLConnectionPool(pool_name="ontiveros_pool", pool_size=5, **DB_CONFIG)
    conn = pool.get_connection()
    cur = conn.cursor()

    # Tabla y columnas (usa exactamente tus nombres en MySQL)
    insert_sql = """
    INSERT INTO `expediente`
        (`exp`, `anual`, `actor`, `empresa`, `estatus`, `especifico`, `abogado`, `ciudad`, `status`, `total_asuntos`)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

    inserted = 0
    skipped = 0
    errors = 0

    try:
        for _, row in df.iterrows():
            exp_val = str(row.get("exp", "")).strip()
            actor_val = str(row.get("actor", "")).strip()

            # Reglas mínimas
            if not exp_val or not actor_val:
                skipped += 1
                continue

            # Duplicado por exp
            cur.execute("SELECT COUNT(*) FROM `expediente` WHERE `exp`=%s", (exp_val,))

            if cur.fetchone()[0] > 0:
                skipped += 1
                continue

            vals = (
                exp_val,
                str(row.get("anual", "")).strip(),
                actor_val,
                str(row.get("empresa", "")).strip(),
                str(row.get("estatus", "")).strip(),
                str(row.get("especifico", "")).strip(),
                str(row.get("abogado", "")).strip(),
                str(row.get("ciudad", "")).strip(),
                str(row.get("status", "")).strip(),
                str(row.get("total_asuntos", "")).strip(),
            )
            errors_detail = []
            try:
                print(vals)
                cur.execute(insert_sql, vals)
                inserted += 1
            except Exception as e:
                errors += 1
                if len(errors_detail) < 5:  # guarda hasta 5 mensajes
                    errors_detail.append(str(e))
                continue

        conn.commit()
    finally:
        cur.close()
        conn.close()

    return {
    "inserted": inserted,
    "skipped": skipped,
    "errors": errors,
    "errors_detail": errors_detail,     # <— nuevo
    "received_rows": int(df.shape[0]),
    "normalized_headers": list(df.columns),
}
