"""
Common dependencies.

Provee autenticación JWT para FastAPI mediante HTTP Bearer.
Al usar Security(HTTPBearer), Swagger UI muestra el botón "Authorize".
"""

from __future__ import annotations

import os
from typing import Dict

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SECRET_KEY = os.getenv("SECRET_KEY", "secret")
ALGORITHMS = ["HS256"]

security = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> Dict:
    """
    Valida Authorization: Bearer <access_token> y retorna el payload.
    Lanza 401 si falta header, token inválido/expirado, o si no es access.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=ALGORITHMS)

        # ✅ clave: solo aceptar access tokens
        token_type = payload.get("type")
        if token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
