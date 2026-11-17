"""Rutas HTTP de la encuesta para locales.

`POST /encuesta` es público (sin cuenta, para compartir por WhatsApp); el
resto es sólo admin. Sin IP guardada: la IP sólo cuenta contra el límite de
pedidos, en memoria (ADR-0024).
"""

from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.core.rate_limit import RateLimiter
from app.modules.encuesta.api.dependencies import get_survey_service
from app.modules.encuesta.api.schemas import (
    SurveyListResponse,
    SurveyReceivedResponse,
    SurveyResponseOut,
    SurveySubmitRequest,
    SurveySummaryResponse,
)
from app.modules.encuesta.application.services import SurveyService
from app.modules.encuesta.domain.entities import SurveyResponse
from app.modules.encuesta.domain.exceptions import InvalidSurveyError
from app.modules.identity.api.dependencies import require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole

public_router = APIRouter(prefix="/encuesta", tags=["encuesta"])
admin_router = APIRouter(prefix="/admin/encuesta", tags=["admin"])

# Varios locales pueden compartir el wifi del barrio: generoso, pero frena a un
# robot que reenvía en loop.
_submit_rate_limit = RateLimiter(max_attempts=20, window_seconds=600, name="encuesta")

ServiceDep = Annotated[SurveyService, Depends(get_survey_service)]
AdminDep = Annotated[User, Depends(require_roles(UserRole.ADMIN))]


def _to_out(response: SurveyResponse) -> SurveyResponseOut:
    data = asdict(response)
    data.pop("client_key")
    return SurveyResponseOut(**data)


@public_router.post(
    "",
    response_model=SurveyReceivedResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_submit_rate_limit)],
    summary="Responder la encuesta para locales (público)",
)
async def submit_survey(
    body: SurveySubmitRequest,
    service: ServiceDep,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key", max_length=80)] = None,
):
    # `core/idempotency.py` ata la clave a un usuario con sesión; acá no hay,
    # así que la clave se guarda con la respuesta y un reintento no duplica.
    if body.company_website:
        # Robot: se descarta en silencio, con la misma respuesta que un éxito.
        return SurveyReceivedResponse()
    try:
        response = SurveyResponse.create(
            **body.model_dump(exclude={"company_website"}),
            client_key=idempotency_key,
        )
    except InvalidSurveyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    await service.submit(response)
    return SurveyReceivedResponse()


@admin_router.get("", response_model=SurveyListResponse, summary="Respuestas, las más nuevas primero")
async def list_responses(
    _: AdminDep,
    service: ServiceDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    with_contact: bool = False,
):
    items, total = await service.list_responses(
        limit=limit, offset=offset, only_with_contact=with_contact
    )
    return SurveyListResponse(items=[_to_out(r) for r in items], total=total)


@admin_router.get(
    "/summary", response_model=SurveySummaryResponse, summary="Resumen de la encuesta"
)
async def summary(_: AdminDep, service: ServiceDep):
    return SurveySummaryResponse(**asdict(await service.summary()))
