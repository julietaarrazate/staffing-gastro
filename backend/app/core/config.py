"""Configuración central de la aplicación.

Carga las variables de entorno (o el archivo .env) usando pydantic-settings.
Esta es la única fuente de verdad para la configuración del backend.
"""

from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Secreto JWT por defecto: sólo válido en desarrollo. En producción DEBE
# reemplazarse por env var (en Render se genera automáticamente). El arranque
# falla si este valor llega a producción (ver _reject_insecure_defaults).
_DEFAULT_JWT_SECRET = "cambiar-esto-en-produccion"


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
            value = value.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Proveedores gestionados (Neon) agregan parámetros de libpq que asyncpg
        # NO acepta y rompen el arranque ("unexpected keyword argument 'sslmode'").
        # Se traducen: sslmode/channel_binding se quitan y, si pedían TLS, se
        # deja `ssl=require` (parámetro que el dialecto asyncpg sí entiende).
        if "+asyncpg" in value and ("sslmode=" in value or "channel_binding=" in value):
            from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

            parts = urlsplit(value)
            params = dict(parse_qsl(parts.query))
            sslmode = params.pop("sslmode", None)
            params.pop("channel_binding", None)
            if sslmode and sslmode != "disable" and "ssl" not in params:
                params["ssl"] = "require"
            value = urlunsplit(parts._replace(query=urlencode(params)))
        return value

    # --- JWT ---
    jwt_secret_key: str = _DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # --- Seguridad ---
    # Rate limiting en memoria de endpoints sensibles (login/registro).
    rate_limit_enabled: bool = True

    # --- Observabilidad ---
    # DSN de Sentry (captura de errores). Vacío = Sentry desactivado; se
    # enciende solo con setear la env var SENTRY_DSN en Render (R1.1).
    sentry_dsn: str = ""
    # Logging estructurado JSON con request_id (apto para agregadores).
    # En desarrollo conviene texto plano legible.
    log_json: bool = False

    # --- CORS ---
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    # --- Suscripciones / cobro (ADR-0005 Fase 1: mensualidad) ---
    # Credenciales de Mercado Pago para el cobro recurrente (preapproval, NO
    # split). Vacío = feature de cobro real desactivada: el plan se puede
    # setear igual (`POST /subscription/subscribe` con el flag apagado), pero
    # no se intenta cobrar (mismo patrón "flag por ausencia" que `sentry_dsn`).
    mercadopago_access_token: str = ""
    mercadopago_base_url: str = "https://api.mercadopago.com"

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

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    @model_validator(mode="after")
    def _reject_insecure_defaults(self) -> "Settings":
        # En producción no se permite arrancar con el secreto JWT por defecto:
        # firmaría tokens con una clave pública conocida. Fail-fast explícito.
        if self.is_production and self.jwt_secret_key == _DEFAULT_JWT_SECRET:
            raise ValueError(
                "JWT_SECRET_KEY no configurado: en producción debe definirse "
                "una clave secreta propia (env var), no el valor por defecto."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de la configuración."""
    return Settings()


settings = get_settings()
