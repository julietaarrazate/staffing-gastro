"""A quiénes les llega el aviso de un turno cerca (decisión de Julieta,
2026-11-28).

El aviso tiene tope para seguir siendo señal y no ruido. Pero un tope que se
llena sólo por ranking deja siempre afuera a quien recién entra: sin historial
no llega al aviso, y sin aviso no hace su primer turno. Por eso una parte del
cupo se reserva para gente nueva (sin turnos hechos en Oído) con la identidad
verificada, la más cercana primero: verificada porque, con la verificación
obligatoria, a quien no lo está el comercio no la puede elegir.
"""

from collections.abc import Collection, Sequence
from typing import Protocol, TypeVar
from uuid import UUID

# Uno de cada cuatro lugares: 5 de 20 en la primera tanda, 10 de 40 en la
# escalada.
PARTE_PARA_NUEVOS = 4


class Candidato(Protocol):
    profile_id: UUID
    user_id: UUID
    events_completed: int
    distance_km: float | None


C = TypeVar("C", bound=Candidato)


def repartir_cupo(ranked: Sequence[C], limit: int, verificados: Collection[UUID]) -> list[C]:
    """De `ranked` (ya ordenado de mejor a peor), los `limit` que reciben el
    aviso: los mejores, con hasta `limit // PARTE_PARA_NUEVOS` lugares para
    gente nueva verificada que no entraba por ranking. Si no hay tanta gente
    nueva, esos lugares vuelven a los que siguen en el ranking: el cupo nunca
    queda sin usar. Devuelve en el orden del ranking."""
    if limit <= 0:
        return []
    if len(ranked) <= limit:
        return list(ranked)
    reservados = limit // PARTE_PARA_NUEVOS
    por_ranking = list(ranked[: limit - reservados])
    adentro = {c.profile_id for c in por_ranking}
    nuevos = sorted(
        (
            c
            for c in ranked[limit - reservados :]
            if c.events_completed == 0 and c.user_id in verificados
        ),
        key=lambda c: (c.distance_km is None, c.distance_km or 0.0),
    )[:reservados]
    adentro |= {c.profile_id for c in nuevos}
    faltan = limit - len(adentro)
    for c in ranked:
        if faltan == 0:
            break
        if c.profile_id not in adentro:
            adentro.add(c.profile_id)
            faltan -= 1
    return [c for c in ranked if c.profile_id in adentro]
