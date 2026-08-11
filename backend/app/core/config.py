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
    app_name: str = "Oído"
    environment: str = "development"
    debug: bool = True

    # --- Base de datos ---
    database_url: str = "postgresql+asyncpg://oido:oido@localhost:5432/oido"

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

    # Hacer cumplir el tope de turnos por plan (ADR-0005 Fase 1). Default OFF:
    # durante la beta temprana los comercios publican libre para generar
    # liquidez; se enciende cuando la operadora decide monetizar. El uso se
    # cuenta igual estando apagado.
    subscriptions_enforced: bool = False

    # --- Email transaccional (Resend) ---
    # Sin `resend_api_key` configurada se inyecta un `NullEmailSender` que sólo
    # loguea y nunca falla (mismo patrón "flag por ausencia" que
    # `mercadopago_access_token`/`sentry_dsn`): el envío de email es best-effort
    # y jamás debe romper un flujo de negocio (registro, recuperación de
    # contraseña, asignación de turno).
    resend_api_key: str = ""
    email_from: str = "Oído <onboarding@resend.dev>"

    # URL pública del frontend (Vercel), usada para armar links de emails
    # transaccionales (p. ej. `{frontend_url}/restablecer?token=...`).
    frontend_url: str = "https://staffing-gastro.vercel.app"

    # --- Google Sign-In (opt-in) — ver docs/reference/ACCESO_MODERNO.md ---
    # Client ID de un "OAuth 2.0 Client ID" tipo Web application, creado en
    # console.cloud.google.com → APIs & Services → Credentials. Vacío = botón
    # "Continuar con Google" oculto en el frontend y `POST /auth/google`
    # responde 503 (mismo patrón "flag por ausencia" que `resend_api_key` /
    # `mercadopago_access_token`). No hace falta client secret: el flujo usa
    # Google Identity Services (ID token verificado server-side), no
    # authorization-code — ver derivación en docs/reference/ACCESO_MODERNO.md.
    google_client_id: str = ""

    # --- Notificaciones push (Web Push / VAPID) — ver docs/reference/ACCESO_MODERNO.md ---
    # Par de claves VAPID (formato base64url sin padding). Vacío = envío de
    # push desactivado (flag por ausencia): las suscripciones se pueden crear
    # igual, pero `WebPushSender` no intenta enviar nada. Se generan una sola
    # vez (comando en docs/reference/ACCESO_MODERNO.md § Feature 2, "Cómo generar el
    # par de claves") y se cargan como env vars en Render.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    # Contacto requerido por el estándar VAPID (claim "sub"): se manda como
    # `mailto:` a los servicios push (Chrome/Firefox) para que puedan
    # contactar al operador si una suscripción abusa del canal.
    vapid_contact_email: str = "soporte@staffya.com"

    # --- Cloudinary (subida firmada) — C.2(b), auditoría de producto 2026-08-10 ---
    # Cloudinary bloquea por default la entrega de recursos raw/PDF subidos con
    # un `upload_preset` unsigned (medida anti-abuso desde 2023) — causa real
    # confirmada de que un CV subido como PDF suba bien pero no abra
    # (`ERR_INVALID_RESPONSE`, docs/STATUS.md). Vacío = `POST /uploads/sign-cv`
    # responde 503 (mismo patrón "flag por ausencia" que `google_client_id`) y
    # el CV sigue subiéndose sin firmar (el toggle del dashboard de Cloudinary
    # sigue siendo el fallback documentado para Julieta). El `api_key` no es
    # secreto por sí solo (necesita la firma para ser usable), pero se carga
    # server-side igual, junto al `api_secret`, para no duplicar configuración.
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # --- Gemini (turno por texto libre) — P2, auditoría de producto 2026-08-10 ---
    # El comercio describe el turno en texto libre ("necesito 2 mozos el sábado
    # a la noche") y Gemini lo traduce a campos estructurados que PRECARGAN el
    # wizard de publicar turno — el comercio sigue revisando y confirmando cada
    # paso a mano, nunca se publica nada directo desde acá (regla no negociable:
    # la IA interpreta intención, el motor de turnos/matching decide
    # resultados). Vacío = `POST /shifts/parse-text` responde 503 (mismo patrón
    # "flag por ausencia" que `google_client_id`). Plan free de Google alcanza
    # de sobra para esta beta (gemini-3.5-flash: 250 requests/día).
    gemini_api_key: str = ""

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
