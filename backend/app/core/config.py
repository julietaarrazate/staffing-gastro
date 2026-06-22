"""Configuración central de la aplicación.

Carga las variables de entorno (o el archivo .env) usando pydantic-settings.
Esta es la única fuente de verdad para la configuración del backend.
"""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Aplicación ---
    app_name: str = "Staffya"
    environment: str = "development"
    debug: bool = True

    # --- Base de datos ---
    database_url: str = "postgresql+asyncpg://staffya:staffya@localhost:5432/staffya"

    @field_validator("database_url")
    @classmethod
    def _force_asyncpg_driver(cls, value: str) -> str:
        # Proveedores como Render entregan una connection string "postgresql://"
        # (driver psycopg2 por defecto); el proyecto usa SQLAlchemy async + asyncpg.
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        return value

    # --- JWT ---
    jwt_secret_key: str = "cambiar-esto-en-produccion"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # --- CORS ---
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    # --- Administración ---
    # Emails que se promueven a rol admin al iniciar la app (separados por coma).
    # Permite dar de alta al primer administrador sin endpoint de auto-registro.
    admin_emails: str = ""

    @property
    def admin_emails_list(self) -> list[str]:
        return [
            email.strip().lower()
            for email in self.admin_emails.split(",")
            if email.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de la configuración."""
    return Settings()


settings = get_settings()
