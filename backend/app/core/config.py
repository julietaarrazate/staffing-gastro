"""Configuración central de la aplicación.

Carga las variables de entorno (o el archivo .env) usando pydantic-settings.
Esta es la única fuente de verdad para la configuración del backend.
"""

from functools import lru_cache

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


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de la configuración."""
    return Settings()


settings = get_settings()
