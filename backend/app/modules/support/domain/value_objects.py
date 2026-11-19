"""Objetos de valor del dominio de soporte."""

from enum import Enum


class TicketCategory(str, Enum):
    """Categoría de un ticket de soporte.

    Existe desde el día uno (C.1/C.8, auditoría de producto 2026-08-10) para
    que "reportar turno"/"reportar usuario" puedan entrar como una categoría
    más de este mismo dominio, sin construir un dominio nuevo de moderación:
    "turno" y "comercio" (U110) ya entraron; "usuario" todavía no.
    """

    GENERAL = "general"
    CV_DOCUMENTOS = "cv_documentos"
    PAGOS = "pagos"
    CUENTA = "cuenta"
    # U110: un problema con un turno o con un comercio puntual. El ticket puede
    # llevar la referencia (`shift_id`/`company_id`), validada en el caso de uso.
    TURNO = "turno"
    COMERCIO = "comercio"
    OTRO = "otro"


class TicketStatus(str, Enum):
    """Estado de un ticket. Deliberadamente sólo dos: sin SLA, sin
    asignación, sin categorías de progreso — sobredimensionado para 3-5
    comercios y 20-50 trabajadores (auditoría de producto 2026-08-10, C.1)."""

    ABIERTO = "abierto"
    CERRADO = "cerrado"
