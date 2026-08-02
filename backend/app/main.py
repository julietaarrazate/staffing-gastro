"""Punto de entrada de la API de Oído (monolito modular).

Cada módulo de dominio (identity, worker, shift, ...) registra su propio router.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.idempotency import IdempotencyReplay
from app.core.middleware import SecurityHeadersMiddleware
from app.core.observability import RequestIdMiddleware, setup_logging, setup_sentry
from app.modules.admin.api.routes import router as admin_router
from app.modules.admin.bootstrap import promote_configured_admins
from app.modules.application.api.routes import router as application_router
from app.modules.chat.api.routes import router as chat_router
from app.modules.company.api.routes import router as company_router
from app.modules.identity.api.routes import router as identity_router
from app.modules.matching.api.routes import router as matching_router
from app.modules.matching.api.routes import search_router as matching_search_router
from app.modules.notification.api.routes import push_router
from app.modules.notification.api.routes import router as notification_router
from app.modules.review.api.routes import router as review_router
from app.modules.shift.api.routes import router as shift_router
from app.modules.shift.application.scheduler import start_scheduler
from app.modules.subscription.api.routes import router as subscription_router
from app.modules.worker.api.routes import router as worker_router


# Observabilidad (R1.1): logging estructurado + Sentry (no-op sin SENTRY_DSN).
setup_logging()
setup_sentry()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Promueve a admin los emails configurados en ADMIN_EMAILS (idempotente).
    await promote_configured_admins()
    # Scheduler del ciclo de vida del turno (asistencia + escalada de
    # urgencia): no-op fuera de producción.
    scheduler_task = start_scheduler()
    yield
    if scheduler_task is not None:
        scheduler_task.cancel()


app = FastAPI(
    title=settings.app_name,
    description="Plataforma de staffing en tiempo real para gastronomía y eventos.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Headers de seguridad en cada respuesta; HSTS sólo en producción (HTTPS).
app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)

# request_id por request (header X-Request-ID), correlacionado en los logs.
app.add_middleware(RequestIdMiddleware)


# `api_route` con GET **y HEAD**: los monitores de uptime (UptimeRobot y la
# mayoría) chequean con HEAD por ser más barato, y FastAPI no lo agrega solo a
# una ruta declarada con `@app.get`. Sin HEAD, el healthcheck respondía 405 y
# el monitor reportaba el servicio como CAÍDO estando perfectamente sano
# (verificado en los logs de Render: `"HEAD /health" 405 Method Not Allowed`).
@app.api_route("/health", methods=["GET", "HEAD"], tags=["system"], summary="Healthcheck")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.exception_handler(IdempotencyReplay)
async def handle_idempotency_replay(_: Request, exc: IdempotencyReplay) -> JSONResponse:
    """Reintento con una `Idempotency-Key` ya resuelta: se devuelve la misma
    respuesta guardada la primera vez, sin re-ejecutar el handler (ver
    `app/core/idempotency.py` y `product/IDEMPOTENCIA_SPEC.md`)."""
    return JSONResponse(status_code=exc.status_code, content=exc.body)


# --- Routers de los módulos ---
app.include_router(identity_router, prefix="/api/v1")
app.include_router(worker_router, prefix="/api/v1")
app.include_router(company_router, prefix="/api/v1")
app.include_router(shift_router, prefix="/api/v1")
app.include_router(matching_router, prefix="/api/v1")
app.include_router(matching_search_router, prefix="/api/v1")
app.include_router(notification_router, prefix="/api/v1")
app.include_router(push_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(review_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(application_router, prefix="/api/v1")
app.include_router(subscription_router, prefix="/api/v1")
