"""Punto de entrada de la API de Staffya (monolito modular).

Cada módulo de dominio (identity, worker, shift, ...) registra su propio router.
Por ahora sólo está montado `identity`.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.modules.company.api.routes import router as company_router
from app.modules.identity.api.routes import router as identity_router
from app.modules.matching.api.routes import router as matching_router
from app.modules.shift.api.routes import router as shift_router
from app.modules.worker.api.routes import router as worker_router

app = FastAPI(
    title=settings.app_name,
    description="Plataforma de staffing en tiempo real para gastronomía y eventos.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"], summary="Healthcheck")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


# --- Routers de los módulos ---
app.include_router(identity_router, prefix="/api/v1")
app.include_router(worker_router, prefix="/api/v1")
app.include_router(company_router, prefix="/api/v1")
app.include_router(shift_router, prefix="/api/v1")
app.include_router(matching_router, prefix="/api/v1")
