"""Schemas Pydantic del asistente general de IA del panel del comercio."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.worker.domain.value_objects import WorkerSkill


class AssistantQueryRequest(BaseModel):
    # Mismo tope que `ParseShiftTextRequest` (shift/api/schemas.py) — sin
    # esto, el rate limit acota la CANTIDAD de llamadas a Gemini pero no el
    # TAMAÑO de cada una (auditoría 2026-08-15, F4).
    text: str = Field(min_length=1, max_length=500)


class EventRoleDraft(BaseModel):
    position: WorkerSkill
    quantity: int


class AssistantQueryResponse(BaseModel):
    """Un único campo por intent viene poblado; el resto queda en `None`. El
    frontend rama según `intent` — ver `AIAssistantFab.tsx`."""

    intent: str
    message: str | None = None

    # `crear_turno`
    position: WorkerSkill | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    pay_amount: Decimal | None = None
    urgent: bool | None = None
    meal: bool | None = None
    tips: bool | None = None
    dress_code: str | None = None

    # `crear_evento` (comparte start_at/end_at/pay_amount/urgent/meal/tips/
    # dress_code de arriba, `position` queda en null — cada rol tiene el suyo).
    event_positions: list[EventRoleDraft] | None = None

    # `consultar_turnos`
    query_summary: str | None = None
    query_count: int | None = None
    query_tab: str | None = None

    # `buscar_candidatos`
    search_position: WorkerSkill | None = None

    # `ver_postulantes`
    matched_shift_id: UUID | None = None

    # `consultar_verificacion`
    verification_full_name: str | None = None
    verification_verified: bool | None = None


class WorkerQueryRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class WorkerQueryResponse(BaseModel):
    """Respuesta del asistente del trabajador: filtros estructurados para
    `GET /shifts/feed`, nunca resultados ya resueltos (ver docstring de
    `interpret_worker_shift_query` en `core/gemini.py`) — el frontend arma la
    búsqueda con esto (zona -> lat/lng via la tabla de barrios que ya tiene,
    radio, fecha) y la ejecuta contra el feed real."""

    intent: str
    message: str | None = None
    positions: list[WorkerSkill] | None = None
    zone_name: str | None = None
    radius_km: float | None = None
    date_filter: str | None = None
