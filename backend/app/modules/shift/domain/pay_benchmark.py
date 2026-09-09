"""Pago de referencia del mercado (ADR-0012): cálculo puro, sin frameworks.

Responde una sola pregunta —"¿este turno paga por encima o por debajo de lo
normal para este puesto en esta ciudad?"— y la responde para las dos partes:
al trabajador le dice qué oportunidad vale la pena, al comercio por qué su
turno no se llena.

El motor de matching (`matching/domain/scoring.py`) NO sirve para esto y el
ADR-0012 explica por qué: el 70% de su peso son atributos del trabajador, que
no cambian entre un turno y otro.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import Enum

# Turnos mínimos para que exista una referencia. Por debajo de esto el
# resultado es `None` y la UI no muestra nada: en una beta cerrada la muestra
# escasea, y una mediana de dos turnos no es un dato del mercado, es una
# coincidencia. Semilla conservadora, ajustable con volumen real (ADR-0012).
MIN_SAMPLE_SIZE = 5

# Sólo turnos recientes. En Argentina un pago de referencia de hace meses no
# está viejo: está mal, y le diría al comercio que paga bien cuando ya no.
BENCHMARK_WINDOW_DAYS = 60

# Margen alrededor de la mediana que todavía cuenta como "lo típico". Sin
# esta banda, un turno que paga 2% más saldría "por encima" por redondeo y la
# señal perdería todo su valor.
TYPICAL_BAND = Decimal("0.10")


class PayBand(str, Enum):
    """Dónde cae el pago de un turno respecto de la referencia del mercado."""

    POR_ENCIMA = "por_encima"
    TIPICO = "tipico"
    POR_DEBAJO = "por_debajo"


@dataclass(frozen=True)
class PayBenchmark:
    """Referencia de mercado para un puesto en una ciudad."""

    hourly_median: Decimal
    sample_size: int


def hourly_rate(pay_amount: Decimal, start_at: datetime, end_at: datetime) -> Decimal | None:
    """Pago por hora del turno.

    La normalización es la regla que hace que esto signifique algo:
    `pay_amount` es del turno COMPLETO y los turnos duran distinto, así que
    comparar el pago de uno de 4 horas contra uno de 8 no compara nada. Sin
    esto la feature sería ruido con apariencia de dato.

    Devuelve `None` para una duración no positiva (dato inconsistente): la
    entidad `Shift` ya lo valida al crearse, pero un cálculo puro no asume
    que todo lo que le llega pasó por ahí.
    """
    hours = Decimal((end_at - start_at).total_seconds()) / Decimal(3600)
    if hours <= 0:
        return None
    return pay_amount / hours


def build_benchmark(hourly_rates: list[Decimal]) -> PayBenchmark | None:
    """Referencia a partir de los pagos por hora de la muestra.

    `None` si no hay muestra suficiente — y ése es el caso normal al arrancar,
    no un error. Preferimos no decir nada antes que inventar un número: una
    referencia falsa es peor que ninguna para las dos partes.
    """
    if len(hourly_rates) < MIN_SAMPLE_SIZE:
        return None
    return PayBenchmark(hourly_median=_median(hourly_rates), sample_size=len(hourly_rates))


def classify(rate: Decimal, benchmark: PayBenchmark) -> PayBand:
    """En qué banda cae un pago por hora respecto de la referencia."""
    upper = benchmark.hourly_median * (Decimal(1) + TYPICAL_BAND)
    lower = benchmark.hourly_median * (Decimal(1) - TYPICAL_BAND)
    if rate > upper:
        return PayBand.POR_ENCIMA
    if rate < lower:
        return PayBand.POR_DEBAJO
    return PayBand.TIPICO


def _median(values: list[Decimal]) -> Decimal:
    """Mediana, no promedio: con muestras chicas un solo turno de evento con
    pago alto corre el promedio y deja a todos los demás "por debajo de lo
    típico". La mediana no se mueve por un outlier."""
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / Decimal(2)
