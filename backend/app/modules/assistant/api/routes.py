"""Rutas HTTP del módulo assistant (asistente general de IA del panel del
comercio: crear turno/evento, consultar turnos, buscar candidatos, ver
postulantes — todo a partir de una descripción en texto libre o dictada).
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dt import parse_iso_datetime
from app.core.gemini import (
    GeminiNotConfiguredError,
    GeminiRequestError,
    interpret_assistant_query,
)
from app.core.rate_limit import RateLimiter
from app.modules.assistant.api.dependencies import get_assistant_service
from app.modules.assistant.api.schemas import (
    AssistantQueryRequest,
    AssistantQueryResponse,
    EventRoleDraft,
)
from app.modules.assistant.application.services import AssistantService
from app.modules.shift.api.dependencies import get_my_company_id

router = APIRouter(prefix="/assistant", tags=["assistant"])

ServiceDep = Annotated[AssistantService, Depends(get_assistant_service)]
# Sólo el comercio (dueño de sus turnos/postulantes) usa el asistente; ya
# fuerza rol EMPLOYER internamente (ver `get_my_company_id`).
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]

# Por comercio, no por IP (mismo criterio que parse-shift-text/ai-suggestion
# de soporte — protege contra un doble click/loop del frontend, no es la
# cuota real de Gemini).
_assistant_query_rate_limit = RateLimiter(
    max_attempts=15, window_seconds=600, name="assistant_query"
)


@router.post(
    "/query",
    response_model=AssistantQueryResponse,
    summary="Asistente general del panel: interpreta el pedido en texto libre y arma la respuesta",
)
async def query(
    payload: AssistantQueryRequest,
    company_id: CompanyIdDep,
    service: ServiceDep,
) -> AssistantQueryResponse:
    _assistant_query_rate_limit.check(str(company_id))
    try:
        result = await interpret_assistant_query(payload.text)
    except GeminiNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El asistente no está configurado en este servidor",
        ) from exc
    except GeminiRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No pudimos interpretar el texto. Probá reformularlo.",
        ) from exc

    if result.intent == "crear_turno":
        return AssistantQueryResponse(
            intent=result.intent,
            position=result.position,
            start_at=parse_iso_datetime(result.start_at),
            end_at=parse_iso_datetime(result.end_at),
            pay_amount=result.pay_amount,
            urgent=result.urgent,
            meal=result.meal,
            tips=result.tips,
            dress_code=result.dress_code,
        )

    if result.intent == "crear_evento":
        return AssistantQueryResponse(
            intent=result.intent,
            event_positions=[
                EventRoleDraft(position=role.position, quantity=role.quantity)
                for role in result.event_positions
            ],
            start_at=parse_iso_datetime(result.start_at),
            end_at=parse_iso_datetime(result.end_at),
            pay_amount=result.pay_amount,
            urgent=result.urgent,
            meal=result.meal,
            tips=result.tips,
            dress_code=result.dress_code,
        )

    if result.intent == "consultar_turnos":
        summary = await service.summarize_shifts(company_id, result.query_filter or "todos")
        return AssistantQueryResponse(
            intent=result.intent,
            query_summary=summary.summary,
            query_count=summary.count,
            query_tab=summary.tab,
        )

    if result.intent == "buscar_candidatos":
        return AssistantQueryResponse(intent=result.intent, search_position=result.search_position)

    if result.intent == "ver_postulantes":
        shift = await service.find_shift_for_applicants(
            company_id, result.applicants_position, result.applicants_date_hint
        )
        if shift is None:
            return AssistantQueryResponse(
                intent="desconocido",
                message="No encontré un turno tuyo así — revisalo en el panel.",
            )
        return AssistantQueryResponse(intent=result.intent, matched_shift_id=shift.id)

    return AssistantQueryResponse(
        intent="desconocido",
        message="No entendí bien qué necesitás. ¿Podés reformularlo?",
    )
