from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field
from urllib.parse import quote_plus

class Settings(BaseSettings):
    APP_NAME: str = "Ontiveros API"
    API_V1_PREFIX: str = "/api"
    ENV: str = "dev"

    # JWT
    SECRET_KEY: str = Field(default="change-me")
    # Si en .env tienes TOKEN_EXPIRY_HOURS, lo convertimos a minutos más abajo
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
    JWT_ALGORITHM: str = Field(default="HS256")

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost", "http://localhost:3000"
    ]

    # Acepta tus MYSQL_* y mapea a DB_*
    DB_HOST: str = Field(default="localhost", alias="MYSQL_HOST")
    DB_PORT: int = Field(default=3306, alias="MYSQL_PORT")
    DB_USER: str = Field(default="root", alias="MYSQL_USER")
    DB_PASSWORD: str = Field(default="fifolin123", alias="MYSQL_PASSWORD")
    DB_NAME: str = Field(default="ontiveros", alias="MYSQL_DATABASE")
    DB_DRIVER: str = Field(default="pymysql")  # o "mysqlconnector"
    DB_POOL_SIZE: int = Field(default=5, alias="MYSQL_POOL_SIZE")

    # Opcionalmente puedes seguir permitiendo inyectar DATABASE_URL directo:
    DATABASE_URL: str | None = None

    # Aliases opcionales si en tu .env tienes estos nombres:
    TOKEN_EXPIRY_HOURS: int | None = None
    ALGORITHM: str | None = None  # si usas ALGORITHM=HS256 en .env

    class Config:
        env_file = ".env"
        extra = "ignore"

    def model_post_init(self, _):
        # Si te pasan horas, conviértelas a minutos.
        if self.TOKEN_EXPIRY_HOURS is not None:
            self.ACCESS_TOKEN_EXPIRE_MINUTES = self.TOKEN_EXPIRY_HOURS * 60
        # Si te pasan ALGORITHM, respétalo.
        if self.ALGORITHM:
            self.JWT_ALGORITHM = self.ALGORITHM
        # Construye DATABASE_URL si no está seteada
        if not self.DATABASE_URL:
            pwd = quote_plus(self.DB_PASSWORD or "")
            self.DATABASE_URL = (
                f"mysql+{self.DB_DRIVER}://{self.DB_USER}:{pwd}"
                f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
            )

@lru_cache
def get_settings() -> "Settings":
    return Settings()
