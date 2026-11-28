"""Carril urgente (decisión de Julieta, 2026-11-27).

En un turno que empieza pronto, postularse es un compromiso: la persona dice
«Puedo ir ya» y, si el comercio la acepta, el turno queda confirmado sin un
segundo paso suyo. Siguen aceptando las dos partes (la persona al ofrecerse,
el comercio al aceptarla); lo que se ahorra es la espera de «confirmá tu
asistencia», que en un urgente es la más cara.

Se mide contra el momento de la postulación, no contra el de la asignación:
quien se postuló con días de anticipación vio «Postularme», no «Puedo ir ya»,
y a esa persona se le sigue pidiendo que confirme.
"""

from datetime import datetime, timedelta

from app.core.dt import naive

VENTANA_URGENTE = timedelta(hours=6)


def postularse_compromete(inicio: datetime, cuando: datetime) -> bool:
    """¿Postularse en `cuando` a un turno que empieza en `inicio` compromete?"""
    return naive(cuando) >= naive(inicio) - VENTANA_URGENTE
