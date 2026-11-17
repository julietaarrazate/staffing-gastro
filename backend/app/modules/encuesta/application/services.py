"""Casos de uso de la encuesta para locales."""

from datetime import datetime, timezone

from app.modules.encuesta.domain.entities import SurveyResponse, SurveySummary, summarize
from app.modules.encuesta.domain.repositories import SurveyRepository
from app.modules.encuesta.domain.value_objects import CONTACT_RETENTION


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

    async def purge_expired_contacts(self, now: datetime | None = None) -> int:
        """A los 12 meses se borra el contacto; las respuestas quedan como
        estadística anónima."""
        now = now or datetime.now(timezone.utc)
        return await self._surveys.purge_contact_before(now - CONTACT_RETENTION)
