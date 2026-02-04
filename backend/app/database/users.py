# app/db/mysql_raw.py
import os
import pymysql
from contextlib import contextmanager

MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DB = os.getenv("MYSQL_DB", "ontiveros")
MYSQL_CHARSET = "utf8mb4"

@contextmanager
def get_conn():
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        charset=MYSQL_CHARSET,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )
    try:
        yield conn
    finally:
        conn.close()

def fetch_users(limit: int | None = None):
    sql = """
        SELECT
            id_user, name, email, active,
            date, time, token, id_user_creation,
            date_creation, time_creation
        FROM users
        ORDER BY id_user DESC
    """
    if limit:
        sql += " LIMIT %s"
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, (limit,) if limit else None)
        rows = cur.fetchall()
        # tinyint->bool
        for r in rows:
            r["active"] = bool(r.get("active"))
        return rows
