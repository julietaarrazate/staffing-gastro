"""Rutas HTTP del módulo shift (publicación y ciclo de vida del turno)."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.gemini import GeminiNotConfiguredError, GeminiRequestError, parse_shift_text
from app.core.idempotency import IdempotencyRecorder, idempotent
from app.core.rate_limit import RateLimiter
from app.modules.company.api.dependencies import get_company_repository
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.identity.api.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.shift.api.dependencies import (
    get_my_company_id,
    get_my_worker_profile_id,
    get_my_worker_skills,
    get_shift_service,
)
from app.modules.shift.api.schemas import (
    AssignWorkerRequest,
    EventInput,
    EventResponse,
    GeoCheckRequest,
    ParsedShiftDraftResponse,
    ParseShiftTextRequest,
    ShiftInput,
    ShiftPublicResponse,
    ShiftResponse,
)
from app.modules.shift.application.dtos import EventData, EventRoleData, ShiftData
from app.modules.shift.application.services import ShiftService
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import (
    InvalidShiftScheduleError,
    InvalidShiftTransitionError,
    OverlappingShiftError,
    ShiftNotAssignedToWorkerError,
    ShiftNotEditableError,
    ShiftNotFoundError,
)
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.subscription.domain.exceptions import PlanLimitExceededError
from app.modules.worker.domain.value_objects import WorkerSkill

router = APIRouter(prefix="/shifts", tags=["shifts"])

ServiceDep = Annotated[ShiftService, Depends(get_shift_service)]
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]
WorkerProfileIdDep = Annotated[UUID, Depends(get_my_worker_profile_id)]
AuthUserDep = Annotated[User, Depends(get_current_user)]
CompaniesDep = Annotated[CompanyProfileRepository, Depends(get_company_repository)]
# Paginación (R2.1, docs/reference/API.md#paginación): límite generoso por defecto para
# no romper pantallas existentes, tope duro de 100 para no exponer tablas
# completas cuando la plataforma crezca.
LimitDep = Annotated[int, Query(ge=1, le=100)]
OffsetDep = Annotated[int, Query(ge=0)]
# Idempotencia (product/IDEMPOTENCIA_SPEC.md): sólo en las mutaciones de
# cambio de estado listadas en el spec. Se declara SIEMPRE como el último
# parámetro de dependencia de cada endpoint, después de `company_id`/
# `worker_profile_id`, para que un 403 de rol falle antes de reservar la key.
RecorderDep = Annotated[IdempotencyRecorder, Depends(idempotent)]
EmployerDep = Annotated[User, Depends(require_roles(UserRole.EMPLOYER))]

# Por usuario, no por IP (mismo criterio que `_send_message_rate_limit` en
# chat/api/routes.py): protege contra un doble click/loop del frontend, no
# es la cuota real de Gemini (250/día, la aplica Google del lado del
# proveedor y se devuelve como GeminiRequestError si se agota).
_parse_shift_text_rate_limit = RateLimiter(
    max_attempts=15, window_seconds=600, name="parse-shift-text"
)


def _to_data(payload: ShiftInput) -> ShiftData:
    return ShiftData(**payload.model_dump())


async def _with_company_info(
    shifts: list[Shift], companies: CompanyProfileRepository
) -> list[ShiftResponse]:
    """Suma el nombre/logo del comercio a cada turno (resuelto vía company,
    sin acoplar el dominio de shift a company).

    P3 (docs/audits/PERFORMANCE_REPORT.md): antes hacía 1 `get_by_id` por comercio
    DISTINTO en la página (con caché local sólo para no repetir el mismo
    comercio dos veces) — un feed de 40 turnos de 40 comercios distintos
    disparaba 40 queries secuenciales. Ahora arma la lista de ids únicos y
    hace UN `list_by_ids` (`WHERE id IN (...)`) antes del loop: 1 query
    total, sin importar cuántos comercios distintos aparezcan en la página."""
    unique_ids = list({shift.company_id for shift in shifts})
    companies_by_id = await companies.list_by_ids(unique_ids)
    responses = []
    for shift in shifts:
        company = companies_by_id.get(shift.company_id)
        response = ShiftResponse.model_validate(shift)
        if company:
            response.company_name = company.name
            response.company_logo_url = company.logo_url
        responses.append(response)
    return responses


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado")


@router.post(
    "",
    response_model=ShiftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Publicar un turno (crea en estado BORRADOR)",
)
async def create_shift(
    payload: ShiftInput, company_id: CompanyIdDep, service: ServiceDep, recorder: RecorderDep
):
    try:
        shift = await service.create_shift(company_id, _to_data(payload))
    except InvalidShiftScheduleError as exc:
        raise _bad_request(str(exc)) from exc
    response = ShiftResponse.model_validate(shift)
    # Idempotencia (D3, auditoría de producto/UI 2026-08-09): sin esto, un
    # reintento tras un timeout/corte de red que sí llegó a crear el turno en
    # el backend crea un segundo turno duplicado al reintentar desde el
    # wizard.
    await recorder.save(status.HTTP_201_CREATED, response.model_dump(mode="json"))
    return response


@router.post(
    "/parse-text",
    response_model=ParsedShiftDraftResponse,
    summary="Interpretar una descripción en texto libre y precargar el wizard de turno",
)
async def parse_text(
    payload: ParseShiftTextRequest, current_user: EmployerDep
) -> ParsedShiftDraftResponse:
    # Sólo PRECARGA el wizard — el comercio revisa y confirma cada paso a
    # mano en /shifts/new antes de publicar nada (la IA interpreta
    # intención, el motor de turnos/matching decide resultados).
    _parse_shift_text_rate_limit.check(str(current_user.id))
    try:
        draft = await parse_shift_text(payload.text)
    except GeminiNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La interpretación por IA no está configurada en este servidor",
        ) from exc
    except GeminiRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No pudimos interpretar el texto. Completá los datos a mano.",
        ) from exc

    return ParsedShiftDraftResponse(
        position=draft.position,
        start_at=_safe_datetime(draft.start_at),
        end_at=_safe_datetime(draft.end_at),
        pay_amount=draft.pay_amount,
        urgent=draft.urgent,
        meal=draft.meal,
        tips=draft.tips,
        dress_code=draft.dress_code,
    )


def _safe_datetime(value: str | None) -> datetime | None:
    """Gemini puede devolver un horario mal formado (o directamente texto
    en vez de ISO-8601) pese al `responseSchema` — se descarta ese campo en
    vez de romper el endpoint entero; el comercio lo completa a mano."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


@router.get(
    "/feed",
    response_model=list[ShiftResponse],
    summary="Feed de turnos abiertos (para trabajadores)",
)
async def feed(
    service: ServiceDep,
    companies: CompaniesDep,
    _current_user: AuthUserDep,
    my_skills: Annotated[list[WorkerSkill] | None, Depends(get_my_worker_skills)],
    city: Annotated[str | None, Query()] = None,
    position: Annotated[WorkerSkill | None, Query()] = None,
    urgent: Annotated[bool | None, Query()] = None,
    limit: LimitDep = 50,
    offset: OffsetDep = 0,
):
    # Sin filtro explícito de `position`, el feed sólo muestra los rubros que
    # el trabajador eligió en su perfil — antes le llegaban ofertas de
    # cualquier rubro (a un cajero/bartender le aparecía una de cocinero),
    # ruido puro (Julieta, 2026-07-30). Si no tiene perfil o no eligió
    # ninguno todavía, no se filtra (mismo comportamiento de siempre).
    shifts = await service.list_feed(
        city=city,
        position=position,
        positions=None if position is not None else my_skills,
        urgent=urgent,
        limit=limit,
        offset=offset,
    )
    return await _with_company_info(shifts, companies)


@router.get(
    "/me",
    response_model=list[ShiftResponse],
    summary="Mis turnos publicados (comercio)",
)
async def my_shifts(
    company_id: CompanyIdDep,
    service: ServiceDep,
    limit: LimitDep = 50,
    offset: OffsetDep = 0,
):
    return await service.list_company_shifts(company_id, limit=limit, offset=offset)


@router.get(
    "/mine",
    response_model=list[ShiftResponse],
    summary="Mis turnos asignados (trabajador)",
)
async def my_assigned_shifts(
    worker_profile_id: WorkerProfileIdDep,
    service: ServiceDep,
    companies: CompaniesDep,
    limit: LimitDep = 50,
    offset: OffsetDep = 0,
):
    shifts = await service.list_worker_shifts(worker_profile_id, limit=limit, offset=offset)
    return await _with_company_info(shifts, companies)


@router.post(
    "/events",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Publicar varios turnos de una vez para un evento (catering, boda, etc.)",
)
async def create_event(
    payload: EventInput,
    company_id: CompanyIdDep,
    service: ServiceDep,
    companies: CompaniesDep,
    recorder: RecorderDep,
):
    result = await service.create_event(
        company_id,
        EventData(
            name=payload.name,
            start_at=payload.start_at,
            end_at=payload.end_at,
            roles=[
                EventRoleData(position=r.position, count=r.count, pay_amount=r.pay_amount)
                for r in payload.roles
            ],
            currency=payload.currency,
            tips=payload.tips,
            meal=payload.meal,
            dress_code=payload.dress_code,
            urgent=payload.urgent,
            address=payload.address,
            city=payload.city,
            latitude=payload.latitude,
            longitude=payload.longitude,
            description=payload.description,
        ),
    )
    shifts = await _with_company_info(result.shifts, companies)
    response = EventResponse(event_id=result.event_id, requested=result.requested, shifts=shifts)
    # Idempotencia (D3, auditoría de producto/UI 2026-08-09): un evento crea
    # varios turnos de una sola vez (uno por rol) — un reintento sin esto
    # duplica el set entero, no sólo un turno.
    await recorder.save(status.HTTP_201_CREATED, response.model_dump(mode="json"))
    return response


@router.get(
    "/{shift_id}",
    response_model=ShiftResponse,
    summary="Ver un turno",
)
async def get_shift(shift_id: UUID, service: ServiceDep, _current_user: AuthUserDep):
    try:
        return await service.get_shift(shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc


@router.get(
    "/{shift_id}/public",
    response_model=ShiftPublicResponse,
    summary="Ver un turno publicado sin autenticación (para compartir por WhatsApp/redes)",
)
async def get_shift_public(
    shift_id: UUID, service: ServiceDep, companies: CompaniesDep
):
    """Sin auth. Sólo turnos en estado PUBLICADO; cualquier otro estado (o id
    inexistente) devuelve 404 para no filtrar la existencia/estado interno del
    turno. Expone únicamente campos seguros (ver `ShiftPublicResponse`): nada
    de contacto del comercio, postulantes, ni ids internos más allá del
    propio turno."""
    try:
        shift = await service.get_shift(shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    if shift.status != ShiftStatus.PUBLICADO:
        raise _not_found()
    company = await companies.get_by_id(shift.company_id)
    return ShiftPublicResponse(
        id=shift.id,
        position=shift.position,
        start_at=shift.start_at,
        end_at=shift.end_at,
        city=shift.city,
        pay_amount=shift.pay_amount,
        currency=shift.currency,
        company_name=company.name if company else None,
    )


@router.put(
    "/{shift_id}",
    response_model=ShiftResponse,
    summary="Editar un turno (sólo en BORRADOR o PUBLICADO)",
)
async def update_shift(
    shift_id: UUID,
    payload: ShiftInput,
    company_id: CompanyIdDep,
    service: ServiceDep,
):
    try:
        return await service.update_shift(company_id, shift_id, _to_data(payload))
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except ShiftNotEditableError as exc:
        raise _bad_request("El turno no puede editarse en su estado actual") from exc
    except InvalidShiftScheduleError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/publish",
    response_model=ShiftResponse,
    summary="Publicar un turno en borrador",
)
async def publish_shift(
    shift_id: UUID, company_id: CompanyIdDep, service: ServiceDep, recorder: RecorderDep
):
    try:
        shift = await service.publish_shift(company_id, shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc
    except PlanLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc)
        ) from exc
    response = ShiftResponse.model_validate(shift)
    await recorder.save(status.HTTP_200_OK, response.model_dump(mode="json"))
    return response


@router.post(
    "/{shift_id}/cancel",
    response_model=ShiftResponse,
    summary="Cancelar un turno",
)
async def cancel_shift(
    shift_id: UUID, company_id: CompanyIdDep, service: ServiceDep, recorder: RecorderDep
):
    try:
        shift = await service.cancel_shift(company_id, shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc
    response = ShiftResponse.model_validate(shift)
    await recorder.save(status.HTTP_200_OK, response.model_dump(mode="json"))
    return response


@router.post(
    "/{shift_id}/assign",
    response_model=ShiftResponse,
    summary="Asignar el turno a uno de los candidatos recomendados",
)
async def assign_worker(
    shift_id: UUID,
    payload: AssignWorkerRequest,
    company_id: CompanyIdDep,
    service: ServiceDep,
    recorder: RecorderDep,
):
    try:
        shift = await service.assign_worker(
            company_id, shift_id, payload.worker_profile_id
        )
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc
    response = ShiftResponse.model_validate(shift)
    await recorder.save(status.HTTP_200_OK, response.model_dump(mode="json"))
    return response


@router.post(
    "/{shift_id}/confirm",
    response_model=ShiftResponse,
    summary="Confirmar la asistencia a un turno asignado (trabajador)",
)
async def confirm_assignment(
    shift_id: UUID,
    worker_profile_id: WorkerProfileIdDep,
    service: ServiceDep,
    recorder: RecorderDep,
):
    try:
        shift = await service.confirm_assignment(worker_profile_id, shift_id)
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except (InvalidShiftTransitionError, OverlappingShiftError) as exc:
        raise _bad_request(str(exc)) from exc
    response = ShiftResponse.model_validate(shift)
    await recorder.save(status.HTTP_200_OK, response.model_dump(mode="json"))
    return response


@router.post(
    "/{shift_id}/reject",
    response_model=ShiftResponse,
    summary="Rechazar un turno asignado (trabajador)",
)
async def reject_assignment(
    shift_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    try:
        return await service.reject_assignment(worker_profile_id, shift_id)
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/worker-cancel",
    response_model=ShiftResponse,
    summary="Cancelar mi asignación ya confirmada a un turno (trabajador)",
)
async def worker_cancel(
    shift_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    try:
        return await service.worker_cancel(worker_profile_id, shift_id)
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/depart",
    response_model=ShiftResponse,
    summary="Marcar que salí hacia el turno (trabajador)",
)
async def depart(
    shift_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    try:
        return await service.depart(worker_profile_id, shift_id)
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/check-in",
    response_model=ShiftResponse,
    summary="Marcar llegada al turno con ubicación (trabajador)",
)
async def check_in(
    shift_id: UUID,
    payload: GeoCheckRequest,
    worker_profile_id: WorkerProfileIdDep,
    service: ServiceDep,
    recorder: RecorderDep,
):
    try:
        shift = await service.check_in(
            worker_profile_id, shift_id, payload.latitude, payload.longitude
        )
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc
    response = ShiftResponse.model_validate(shift)
    await recorder.save(status.HTTP_200_OK, response.model_dump(mode="json"))
    return response


@router.post(
    "/{shift_id}/start-working",
    response_model=ShiftResponse,
    summary="Marcar el inicio efectivo del turno (trabajador)",
)
async def start_working(
    shift_id: UUID, worker_profile_id: WorkerProfileIdDep, service: ServiceDep
):
    try:
        return await service.start_working(worker_profile_id, shift_id)
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/check-out",
    response_model=ShiftResponse,
    summary="Marcar fin del turno con ubicación (trabajador)",
)
async def check_out(
    shift_id: UUID,
    payload: GeoCheckRequest,
    worker_profile_id: WorkerProfileIdDep,
    service: ServiceDep,
    recorder: RecorderDep,
):
    try:
        shift = await service.check_out(
            worker_profile_id, shift_id, payload.latitude, payload.longitude
        )
    except (ShiftNotFoundError, ShiftNotAssignedToWorkerError) as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc
    response = ShiftResponse.model_validate(shift)
    await recorder.save(status.HTTP_200_OK, response.model_dump(mode="json"))
    return response


@router.post(
    "/{shift_id}/no-show",
    response_model=ShiftResponse,
    summary="Marcar que el trabajador asignado no se presentó (comercio)",
)
async def mark_no_show(
    shift_id: UUID, company_id: CompanyIdDep, service: ServiceDep, recorder: RecorderDep
):
    try:
        shift = await service.mark_no_show(company_id, shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc
    response = ShiftResponse.model_validate(shift)
    await recorder.save(status.HTTP_200_OK, response.model_dump(mode="json"))
    return response


@router.post(
    "/{shift_id}/finish",
    response_model=ShiftResponse,
    summary="Cerrar un turno ya trabajado (comercio)",
)
async def finish(shift_id: UUID, company_id: CompanyIdDep, service: ServiceDep):
    try:
        return await service.finish(company_id, shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc


@router.post(
    "/{shift_id}/mark-paid",
    response_model=ShiftResponse,
    summary="Confirmar el pago de un turno finalizado (comercio)",
)
async def mark_paid(shift_id: UUID, company_id: CompanyIdDep, service: ServiceDep):
    try:
        return await service.mark_paid(company_id, shift_id)
    except ShiftNotFoundError as exc:
        raise _not_found() from exc
    except InvalidShiftTransitionError as exc:
        raise _bad_request(str(exc)) from exc
