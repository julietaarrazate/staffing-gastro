"""Value objects de la encuesta para locales: las opciones de cada pregunta."""

from datetime import timedelta
from enum import Enum


class LocalKind(str, Enum):
    RESTAURANTE = "restaurante"
    BAR = "bar"
    CAFE = "cafe"
    COMIDA_RAPIDA = "comida_rapida"
    HELADERIA = "heladeria"
    OTRO = "otro"


class RespondentRole(str, Enum):
    """Quién contesta. Sólo quienes deciden (dueño y encargado) entran al
    resumen que se usa para fijar precios."""

    DUENO = "dueno"
    ENCARGADO = "encargado"
    TRABAJO_EN_EL_LOCAL = "trabajo_en_el_local"
    OTRO = "otro"


DECIDES = (RespondentRole.DUENO, RespondentRole.ENCARGADO)


class TeamModel(str, Enum):
    EQUIPO_FIJO = "equipo_fijo"
    POR_TURNO = "por_turno"
    MIXTO = "mixto"


class EventualRange(str, Enum):
    """Cuántas personas eventuales suma el local en un mes."""

    CERO = "0"
    DE_1_A_3 = "1-3"
    DE_4_A_10 = "4-10"
    MAS_DE_10 = "mas_de_10"


class Role(str, Enum):
    MOZO = "mozo"
    RUNNER = "runner"
    BACHA = "bacha"
    BARRA = "barra"
    BARISTA = "barista"
    COCINA = "cocina"
    CAJA = "caja"
    RECEPCION = "recepcion"
    OTRO = "otro"


class Channel(str, Enum):
    WHATSAPP = "whatsapp"
    CONOCIDOS = "conocidos"
    AGENCIA = "agencia"
    REDES = "redes"
    OTRO = "otro"


class AbsenceOutcome(str, Enum):
    LO_CUBRIO_EL_EQUIPO = "lo_cubrio_el_equipo"
    DOBLE_TURNO = "doble_turno"
    CERRE_UNA_PARTE = "cerre_una_parte"
    PERDI_VENTAS = "perdi_ventas"
    OTRO = "otro"


class PricingPreference(str, Enum):
    MENSUALIDAD = "mensualidad"
    POR_TURNO = "por_turno"
    NO_SE = "no_se"


# Pago por jornada de unas 8 h, en pesos. Rango amplio a propósito (la
# inflación mueve el piso): sólo corta typos y bromas, no opina del precio.
PAY_PER_SHIFT_MIN_ARS = 5_000
PAY_PER_SHIFT_MAX_ARS = 1_000_000

# A los 12 meses de la encuesta se borra el contacto (política de privacidad).
CONTACT_RETENTION = timedelta(days=365)
