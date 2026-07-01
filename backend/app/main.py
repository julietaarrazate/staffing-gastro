"""Punto de entrada de la API de Staffya (monolito modular).

Cada módulo de dominio (identity, worker, shift, ...) registra su propio router.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.middleware import SecurityHeadersMiddleware
from app.modules.admin.api.routes import router as admin_router
from app.modules.admin.bootstrap import promote_configured_admins
from app.modules.application.api.routes import router as application_router
from app.modules.chat.api.routes import router as chat_router
from app.modules.company.api.routes import router as company_router
from app.modules.identity.api.routes import router as identity_router
from app.modules.matching.api.routes import router as matching_router
from app.modules.matching.api.routes import search_router as matching_search_router
from app.modules.notification.api.routes import router as notification_router
from app.modules.review.api.routes import router as review_router
from app.modules.shift.api.routes import router as shift_router
from app.modules.worker.api.routes import router as worker_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Promueve a admin los emails configurados en ADMIN_EMAILS (idempotente).
    await promote_configured_admins()
    yield


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


@app.get("/health", tags=["system"], summary="Healthcheck")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


# --- Routers de los módulos ---
app.include_router(identity_router, prefix="/api/v1")
app.include_router(worker_router, prefix="/api/v1")
app.include_router(company_router, prefix="/api/v1")
app.include_router(shift_router, prefix="/api/v1")
app.include_router(matching_router, prefix="/api/v1")
app.include_router(matching_search_router, prefix="/api/v1")
app.include_router(notification_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(review_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(application_router, prefix="/api/v1")
