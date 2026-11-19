"""Borra el contacto (nombre, teléfono y email) de TODAS las respuestas de la
encuesta para locales (ADR-0025).

El contacto se guarda mientras dure la beta y el lanzamiento de Oído (así lo
dice la política de privacidad). Cuando terminan, se corre esto: las
respuestas quedan como estadística anónima, con el nombre del local (que es de
un comercio, no de una persona). Para una sola respuesta, la admin usa
«Borrar contacto» en `/admin/leads` → Encuesta.

**Es idempotente:** una respuesta que ya no tiene contacto no se cuenta ni se
toca. **Por defecto NO cambia nada** (dry-run): dice cuántas tienen contacto.
Para borrar de verdad, `--apply`.

    cd backend
    python -m scripts.clear_survey_contacts           # sólo cuenta
    python -m scripts.clear_survey_contacts --apply   # borra

Necesita `DATABASE_URL`.
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import AsyncSessionLocal
from app.modules.encuesta.application.services import SurveyService
from app.modules.encuesta.infrastructure.models import SurveyResponseModel
from app.modules.encuesta.infrastructure.repositories import SqlAlchemySurveyRepository


async def run(sessions: async_sessionmaker[AsyncSession], *, apply: bool) -> int:
    """Devuelve cuántas respuestas tenían contacto (y, con `apply`, se borró)."""
    async with sessions() as session:
        if not apply:
            has_contact = or_(
                SurveyResponseModel.contact_name.is_not(None),
                SurveyResponseModel.phone.is_not(None),
                SurveyResponseModel.email.is_not(None),
            )
            return (
                await session.scalar(
                    select(func.count()).select_from(SurveyResponseModel).where(has_contact)
                )
                or 0
            )
        return await SurveyService(SqlAlchemySurveyRepository(session)).clear_all_contacts()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--apply", action="store_true", help="borra de verdad (sin esto, sólo cuenta)")
    args = parser.parse_args()
    count = asyncio.run(run(AsyncSessionLocal, apply=args.apply))
    if args.apply:
        print(f"Contacto borrado de {count} respuestas.")
    else:
        print(f"{count} respuestas tienen contacto. Con --apply se borra.")


if __name__ == "__main__":
    main()
