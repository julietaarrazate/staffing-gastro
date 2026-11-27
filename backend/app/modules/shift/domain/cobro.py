"""«¿Ya cobraste?»: lo que la persona dice del cobro de un turno terminado
(decisión de la dueña, 2026-11-27).

Oído no mueve plata: el comercio le paga a la persona por fuera. Hasta acá sólo
el comercio decía «pagado»; ahora la persona también puede decir si cobró. Es un
registro y un aviso, no una sanción: nada de esto cambia la reputación de nadie.

Reglas (la entidad `Shift` las aplica; acá, la parte de plazos y textos):

- Sólo sobre un turno terminado (cerrado o pagado) que le fue asignado.
- «Sí, cobré» vale siempre y es definitivo.
- «Todavía no cobré» se avisa una sola vez por turno. Si el comercio ya marcó
  «pagado» y la persona dice que no, vale en cualquier momento (hay dos
  versiones y alguien tiene que mirarlo). Si el comercio no marcó nada, recién
  desde `PLAZO_PARA_AVISAR_QUE_NO_COBRO` después de terminado el turno, para no
  alarmar por una demora normal. Después puede pasar a «Sí, cobré».

Sólo reglas y textos; sin imports de afuera del dominio."""

from datetime import datetime, timedelta

from app.core.dt import naive as _naive
from app.core.tz import to_art

# Cuánto después del fin del turno se puede avisar «todavía no cobré» si el
# comercio no marcó el turno como pagado.
PLAZO_PARA_AVISAR_QUE_NO_COBRO = timedelta(hours=24)

YA_CONFIRMASTE_EL_COBRO = (
    "Ya confirmaste que cobraste este turno. Si algo no está bien, escribinos "
    "desde Soporte."
)
TODAVIA_NO_TERMINO = "Este turno todavía no terminó."


def puede_avisar_desde(end_at: datetime, paid_at: datetime | None) -> datetime:
    """Desde cuándo la persona puede avisar que no cobró: desde que el comercio
    marcó «pagado» (no antes: el turno puede cerrarse con el horario todavía por
    delante), o, si no marcó nada, `PLAZO_PARA_AVISAR_QUE_NO_COBRO` después del
    fin del turno."""
    if paid_at is not None:
        return paid_at
    return end_at + PLAZO_PARA_AVISAR_QUE_NO_COBRO


def aun_no_se_puede_avisar(desde: datetime) -> str:
    """Texto para la persona cuando todavía no puede avisar que no cobró."""
    momento = to_art(desde)
    return (
        "Todavía es pronto para avisar que no cobraste: lo podés hacer desde el "
        f"{momento:%d/%m} a las {momento:%H:%M}. Hasta entonces, coordiná el "
        "pago con el comercio por el chat."
    )


def ya_paso(desde: datetime, ahora: datetime) -> bool:
    return _naive(ahora) >= _naive(desde)
