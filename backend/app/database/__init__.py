# app/db/__init__.py
"""
Database configuration and helper utilities.

- Connection pool con mysql.connector.pooling
- Auto-create database si no existe (errno 1049)
- Lee parámetros desde variables de entorno
"""

import os
from typing import Optional

import mysql.connector
from mysql.connector import pooling, errors


_POOL: Optional[pooling.MySQLConnectionPool] = None


def _create_database_if_missing(host: str, port: int, user: str, password: str, database: str) -> None:
    """Conecta sin database y crea la BD si no existe."""
    conn = mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        autocommit=True,
    )
    try:
        cur = conn.cursor()
        cur.execute(
            f"CREATE DATABASE IF NOT EXISTS `{database}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        cur.close()
    finally:
        conn.close()


def init_pool() -> None:
    """Inicializa el pool. Si la BD no existe, la crea y reintenta."""
    global _POOL

    host = os.getenv("DB_HOST", "127.0.0.1")   # usa 127.0.0.1 (no 'localhost') para evitar instancias distintas
    port = int(os.getenv("DB_PORT", "3306"))   # tu XAMPP está en 3308
    database = os.getenv("DB_NAME", "ontiveros")
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "fifolin123")
    pool_size = int(os.getenv("DB_POOL_SIZE", "5"))

    try:
        _POOL = mysql.connector.pooling.MySQLConnectionPool(
            pool_name="fastapi_pool",
            pool_size=pool_size,
            host=host,
            port=port,
            database=database,
            user=user,
            password=password,
            autocommit=True,
        )
    except errors.ProgrammingError as e:
        # 1049 = Unknown database
        if getattr(e, "errno", None) == 1049:
            _create_database_if_missing(host, port, user, password, database)
            # reintenta crear pool ya con la BD lista
            _POOL = mysql.connector.pooling.MySQLConnectionPool(
                pool_name="fastapi_pool",
                pool_size=pool_size,
                host=host,
                port=port,
                database=database,
                user=user,
                password=password,
                autocommit=True,
            )
        else:
            raise


def get_connection() -> mysql.connector.connection.MySQLConnection:
    """Retorna una conexión del pool (autoinicializa si hace falta)."""
    global _POOL
    if _POOL is None:
        init_pool()
    assert _POOL is not None
    return _POOL.get_connection()
