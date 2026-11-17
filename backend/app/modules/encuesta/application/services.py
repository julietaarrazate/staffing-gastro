"""Casos de uso de la encuesta para locales."""

from uuid import UUID

from app.modules.encuesta.domain.entities import SurveyResponse, SurveySummary, summarize
from app.modules.encuesta.domain.exceptions import SurveyNotFoundError
from app.modules.encuesta.domain.repositories import SurveyRepository


class SurveyService:
    def __init__(self, surveys: SurveyRepository) -> None:
        self._surveys = surveys

    async def submit(self, response: SurveyResponse) -> None:
        """Guarda la respuesta. Idempotente por `client_key`: un reintento del
        mismo intento no duplica."""
        if response.client_key and await self._surveys.get_by_client_key(response.client_key):
            return
        await self._surveys.add(response)

    async def list_responses(
        self, *, limit: int, offset: int, only_with_contact: bool = False
    ) -> tuple[list[SurveyResponse], int]:
        return await self._surveys.list_recent(
            limit=limit, offset=offset, only_with_contact=only_with_contact
        )

    async def summary(self) -> SurveySummary:
        return summarize(await self._surveys.list_all())

    async def clear_contact(self, survey_id: UUID) -> SurveyResponse:
        """Borra el contacto de una respuesta (nombre, teléfono y email) y deja
        el resto como estadística. Idempotente: si ya no tenía, no cambia nada."""
        if not await self._surveys.clear_contact(survey_id):
            raise SurveyNotFoundError(survey_id)
        return await self._surveys.get_by_id(survey_id)  # type: ignore[return-value]

    async def clear_all_contacts(self) -> int:
        """Borra el contacto de TODAS las respuestas, para cuando terminan la
        beta y el lanzamiento (ADR-0025). Devuelve cuántas tenían."""
        return await self._surveys.clear_all_contacts()
