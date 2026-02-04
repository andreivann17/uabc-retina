# scripts/import_empresas_desde_excel.py
import string
import secrets
from datetime import datetime
import pandas as pd

# AJUSTA este import a tu estructura real
from app.db import get_connection  # cámbialo si es necesario

EXCEL_PATH = r"c:\Users\andre\Downloads\LISTA DE CLIENTES DIRECTOS.XLSX"
USER_ID = 1  # usuario que registra

# ========================================================
# === Generador de CODE seguro, longitud EXACTA a la BD ===
# ========================================================
CODE_LENGTH = 12  # AJUSTA ESTE VALOR SI TU COLUMNA ES MÁS CORTA

_ALPHANUM = string.ascii_uppercase + string.digits

def _generate_code(n: int = CODE_LENGTH) -> str:
    return "".join(secrets.choice(_ALPHANUM) for _ in range(n))


# ========================================================
# === Cargar Excel normalizando columnas y celdas vacías ===
# ========================================================
def cargar_excel() -> pd.DataFrame:
    df = pd.read_excel(EXCEL_PATH, header=0, usecols=[1, 2, 3], engine='openpyxl')

    # Primera fila tiene encabezados reales
    df.columns = df.iloc[0]
    df = df[1:]

    df = df.rename(columns=lambda c: str(c).strip())

    required_cols = ["CLIENTE", "RAZON SOCIAL", "NOMBRE COMERCIAL Y/O CITADO"]
    for col in required_cols:
        if col not in df.columns:
            raise RuntimeError(f"Columna '{col}' no encontrada en el Excel")

    # Rellenar celdas combinadas
    df["CLIENTE"] = df["CLIENTE"].ffill()
    df["NOMBRE COMERCIAL Y/O CITADO"] = df["NOMBRE COMERCIAL Y/O CITADO"].ffill()

    # Limpiar strings
    # Limpiar strings
    for col in required_cols:
        df[col] = df[col].astype(str).str.strip()


    # Mantener solo filas con razón social válida
    df = df[df["RAZON SOCIAL"].str.strip() != ""].reset_index(drop=True)

    return df


# ========================================================
# === Importación principal a las tablas de empresas =====
# ========================================================
def importar_empresas():
    df = cargar_excel()

    conn = get_connection()
    try:
        conn.start_transaction()
        with conn.cursor() as cur:

            # --- diccionario: nombre_comercial -> id_empresa
            empresas_ids = {}

            # ==============================================
            # 1) Insertar empresas (NOMBRE COMERCIAL)
            # ==============================================
            nombres_comerciales = sorted(set(df["NOMBRE COMERCIAL Y/O CITADO"]))

            sql_insert_empresa = """
                INSERT INTO empresas
                    (nombre, active, code, created_at, updated_at,
                     id_user_created, id_user_updated, cliente_directo,
                     nombre_corresponsal, correo, celular)
                VALUES
                    (%s, 1, %s, NOW(), NOW(),
                     %s, %s, 1,
                     NULL, NULL, NULL)
            """

            for nombre_com in nombres_comerciales:
                if not nombre_com:
                    continue

                code = _generate_code()

                cur.execute(sql_insert_empresa, (
                    nombre_com,
                    code,
                    USER_ID,
                    USER_ID
                ))

                empresas_ids[nombre_com] = cur.lastrowid

            # ==============================================
            # 2) Insertar razones sociales ligadas
            # ==============================================
            sql_insert_razon = """
                INSERT INTO empresas_razon_social
                    (nombre, active, id_empresa, rfc,
                     created_at, updated_at, id_user_created, id_user_updated)
                VALUES
                    (%s, 1, %s, NULL,
                     NOW(), NOW(), %s, %s)
            """

            for _, row in df.iterrows():
                razon_social = row["RAZON SOCIAL"].strip()
                nombre_com = row["NOMBRE COMERCIAL Y/O CITADO"].strip()

                if not razon_social:
                    continue

                id_empresa = empresas_ids.get(nombre_com)
                if not id_empresa:
                    raise RuntimeError(
                        f"No existe empresa para nombre comercial '{nombre_com}'"
                    )

                cur.execute(sql_insert_razon, (
                    razon_social,
                    id_empresa,
                    USER_ID,
                    USER_ID
                ))

        conn.commit()
        print("✔ Importación terminada correctamente.")

    except Exception as e:
        conn.rollback()
        print("✘ Error durante la importación:", e)
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    importar_empresas()
