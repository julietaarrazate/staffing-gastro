"""Rutas HTTP del módulo assistant (asistente general de IA del panel del
comercio: crear turno/evento, consultar turnos, buscar candidatos, ver
postulantes, consultar verificación de un postulante puntual — todo a partir
de una descripción en texto libre o dictada).
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dt import parse_iso_datetime
from app.core.gemini import (
    AssistantQueryResult,
    GeminiNotConfiguredError,
    GeminiRequestError,
    interpret_assistant_query,
    interpret_worker_shift_query,
)
from app.core.rate_limit import RateLimiter
from app.modules.assistant.api.dependencies import get_assistant_service
from app.modules.assistant.api.schemas import (
    AssistantQueryRequest,
    AssistantQueryResponse,
    EventRoleDraft,
    WorkerQueryRequest,
    WorkerQueryResponse,
)
from app.modules.assistant.application.services import AssistantService
from app.modules.identity.api.dependencies import require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.shift.api.dependencies import get_my_company_id
from app.modules.verification.api.dependencies import get_verification_service
from app.modules.verification.application.services import VerificationService

router = APIRouter(prefix="/assistant", tags=["assistant"])

ServiceDep = Annotated[AssistantService, Depends(get_assistant_service)]
# Sólo el comercio (dueño de sus turnos/postulantes) usa el asistente; ya
# fuerza rol EMPLOYER internamente (ver `get_my_company_id`).
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]
VerificationDep = Annotated[VerificationService, Depends(get_verification_service)]
WorkerUserDep = Annotated[User, Depends(require_roles(UserRole.WORKER))]

# Por comercio, no por IP (mismo criterio que parse-shift-text/ai-suggestion
# de soporte — protege contra un doble click/loop del frontend, no es la
# cuota real de Gemini).
_assistant_query_rate_limit = RateLimiter(
    max_attempts=15, window_seconds=600, name="assistant_query"
)

# Por trabajador (mismo criterio que `_assistant_query_rate_limit` arriba).
_worker_query_rate_limit = RateLimiter(
    max_attempts=15, window_seconds=600, name="worker_assistant_query"
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
    verification: VerificationDep,
) -> AssistantQueryResponse:
    _assistant_query_rate_limit.check(str(company_id))
    # P2 (Julieta: "la IA tiene que aprender cosas de cada persona, está muy
    # genérica"): contexto de turnos anteriores de ESTE comercio, para que
    # el asistente complete campos que el texto no menciona (puesto más
    # pedido, horario típico, pago típico) en vez de dejarlos siempre en
    # null. `None` si no hay suficiente historial — Gemini ignora el bloque
    # de contexto cuando no se lo mandamos.
    company_context = await service.build_context_summary(company_id)
    try:
        result = await interpret_assistant_query(payload.text, company_context)
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

    response = await _resolve(result, company_id, service, verification)
    # Señal de uso (P2, Julieta: "que vaya aprendiendo") — se loguea el
    # intent FINAL (post-degrade, ej. `ver_postulantes` sin turno encontrado
    # ya llega acá como `desconocido`), que es la señal honesta de qué tan
    # seguido el asistente resuelve algo útil, no sólo qué clasificó Gemini.
    await service.log_query(company_id, payload.text, response.intent)
    return response


@router.post(
    "/worker-query",
    response_model=WorkerQueryResponse,
    summary="Asistente del trabajador: interpreta una búsqueda de turnos en texto libre",
)
async def worker_query(
    payload: WorkerQueryRequest,
    current_user: WorkerUserDep,
) -> WorkerQueryResponse:
    _worker_query_rate_limit.check(str(current_user.id))
    try:
        result = await interpret_worker_shift_query(payload.text)
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

    # Sin logging de esta consulta a propósito (a diferencia de `query` de
    # arriba): `AssistantQueryLogEntry` está atado a `company_id` (no
    # nullable) — sumarle una señal del trabajador es una migración de
    # esquema aparte, no algo para colar en esta PR.
    if result.intent != "buscar_turnos":
        return WorkerQueryResponse(
            intent="desconocido",
            message="No entendí bien qué turno buscás. ¿Podés reformularlo?",
        )

    return WorkerQueryResponse(
        intent=result.intent,
        positions=result.positions,
        zone_name=result.zone_name,
        radius_km=result.radius_km,
        date_filter=result.date_filter,
    )


async def _resolve(
    result: AssistantQueryResult,
    company_id: UUID,
    service: AssistantService,
    verification: VerificationService,
) -> AssistantQueryResponse:
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

    if result.intent == "consultar_verificacion":
        match = await service.find_applicant_by_name(company_id, result.verification_name or "")
        if match is None:
            return AssistantQueryResponse(
                intent="desconocido",
                message="No encontré ningún postulante con ese nombre entre tus turnos.",
            )
        verified_ids = await verification.verified_user_ids([match.user_id])
        return AssistantQueryResponse(
            intent=result.intent,
            verification_full_name=match.full_name,
            verification_verified=match.user_id in verified_ids,
        )

    return AssistantQueryResponse(
        intent="desconocido",
        message="No entendí bien qué necesitás. ¿Podés reformularlo?",
    )
