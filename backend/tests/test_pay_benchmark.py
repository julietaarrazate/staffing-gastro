"""Pago de referencia (ADR-0012): cálculo puro + lo que llega por la API.

Los tests del dominio fijan las cuatro reglas que hacen que esta feature
signifique algo en vez de ser ruido con apariencia de dato — normalización
horaria, mediana, muestra mínima y banda. Cada una tuvo un motivo escrito en
el ADR; sin test, cualquiera las "simplifica" sin enterarse de lo que rompe.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.modules.shift.domain.pay_benchmark import (
    MIN_SAMPLE_SIZE,
    PayBand,
    build_benchmark,
    classify,
    hourly_rate,
)

from tests.conftest import auth_headers


# --- Dominio: cálculo puro ------------------------------------------------


def test_hourly_rate_normaliza_por_duracion():
    """La regla que sostiene todo: `pay_amount` es del turno completo y los
    turnos duran distinto. Dos turnos que pagan lo mismo pero duran distinto
    NO pagan lo mismo, y sin esto los compararíamos como iguales."""
    start = datetime(2026, 7, 10, 20, 0)
    corto = hourly_rate(Decimal("40000"), start, start + timedelta(hours=4))
    largo = hourly_rate(Decimal("40000"), start, start + timedelta(hours=8))

    assert corto == Decimal("10000")
    assert largo == Decimal("5000")
    assert corto > largo


def test_hourly_rate_rechaza_duracion_no_positiva():
    """La entidad `Shift` ya valida esto al crearse, pero un cálculo puro no
    asume que todo lo que le llega pasó por ahí."""
    momento = datetime(2026, 7, 10, 20, 0)
    assert hourly_rate(Decimal("40000"), momento, momento) is None


def test_benchmark_usa_mediana_y_no_promedio():
    """Un solo turno de evento con pago alto corre el promedio y dejaría a
    todos los demás "por debajo de lo típico" — el error que más rápido haría
    inútil la señal en una muestra chica."""
    tarifas = [Decimal("5000")] * 5 + [Decimal("500000")]

    benchmark = build_benchmark(tarifas)

    assert benchmark is not None
    assert benchmark.hourly_median == Decimal("5000")
    # El promedio daría ~87.500: con él, los cinco turnos normales quedarían
    # marcados "por debajo de lo típico" por culpa de un solo outlier.


def test_sin_muestra_suficiente_no_hay_referencia():
    """Y esto es lo normal al arrancar, no un error: preferimos no decir nada
    antes que inventar un número que engañaría a las dos partes."""
    assert build_benchmark([Decimal("5000")] * (MIN_SAMPLE_SIZE - 1)) is None
    assert build_benchmark([Decimal("5000")] * MIN_SAMPLE_SIZE) is not None


def test_la_banda_absorbe_el_ruido_alrededor_de_la_mediana():
    """Sin banda, un turno que paga 2% más saldría "por encima" por redondeo y
    la mitad del feed se marcaría como oportunidad."""
    benchmark = build_benchmark([Decimal("10000")] * MIN_SAMPLE_SIZE)
    assert benchmark is not None

    assert classify(Decimal("10200"), benchmark) is PayBand.TIPICO
    assert classify(Decimal("9800"), benchmark) is PayBand.TIPICO
    assert classify(Decimal("13000"), benchmark) is PayBand.POR_ENCIMA
    assert classify(Decimal("7000"), benchmark) is PayBand.POR_DEBAJO


# --- API: lo que ven el trabajador y el comercio ---------------------------


async def _employer(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": f"Bar {email[:6]}", "city": "Palermo"},
    )
    return headers


def _payload(pay: str, *, hours: int = 8, city: str | None = "Palermo") -> dict:
    start = datetime.now(timezone.utc) + timedelta(days=3)
    return {
        "position": "mozo",
        "quantity": 1,
        "start_at": start.replace(tzinfo=None).isoformat(),
        "end_at": (start + timedelta(hours=hours)).replace(tzinfo=None).isoformat(),
        "pay_amount": pay,
        "tips": True,
        "city": city,
    }


async def _publicar(client: AsyncClient, headers: dict, payload: dict) -> str:
    created = await client.post("/api/v1/shifts", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    return shift_id


async def test_sin_muestra_el_turno_no_expone_banda(client: AsyncClient):
    """Arrancando de cero no hay mercado con qué comparar: el campo viaja en
    `null` y la UI no dibuja nada. Es el estado normal de la beta."""
    headers = await _employer(client, "bench_emp0@staffya.com")
    await _publicar(client, headers, _payload("40000"))

    mine = await client.get("/api/v1/shifts/me", headers=headers)
    assert mine.status_code == 200
    assert all(s["pay_band"] is None for s in mine.json())


async def test_el_comercio_ve_que_su_turno_paga_por_debajo(client: AsyncClient):
    """La mitad que convierte esto en una herramienta para el comercio: hoy no
    tiene forma de saber por qué su turno no se llena, y la causa más común es
    el precio."""
    headers = await _employer(client, "bench_emp1@staffya.com")
    # Mercado: cinco turnos de 8 h a $80.000 => $10.000/hora.
    for _ in range(MIN_SAMPLE_SIZE):
        await _publicar(client, headers, _payload("80000"))
    # El turno bajo: misma duración, mucho menos plata.
    barato = await _publicar(client, headers, _payload("40000"))

    mine = await client.get("/api/v1/shifts/me", headers=headers)
    shift = next(s for s in mine.json() if s["id"] == barato)
    assert shift["pay_band"] == "por_debajo"


async def test_un_turno_corto_bien_pago_queda_por_encima(client: AsyncClient):
    """La normalización horaria, ya de punta a punta: este turno paga MENOS
    plata en total que los del mercado y aun así es mejor oportunidad, porque
    dura la mitad. Sin normalizar, saldría "por debajo"."""
    headers = await _employer(client, "bench_emp2@staffya.com")
    for _ in range(MIN_SAMPLE_SIZE):
        await _publicar(client, headers, _payload("80000", hours=8))
    corto = await _publicar(client, headers, _payload("60000", hours=4))

    mine = await client.get("/api/v1/shifts/me", headers=headers)
    shift = next(s for s in mine.json() if s["id"] == corto)
    assert shift["pay_band"] == "por_encima"


async def test_el_trabajador_ve_la_banda_en_su_feed(client: AsyncClient):
    """La cara del trabajador: es el dato que alimenta el estado "match" del
    pin en `/map`."""
    headers = await _employer(client, "bench_emp3@staffya.com")
    for _ in range(MIN_SAMPLE_SIZE):
        await _publicar(client, headers, _payload("80000"))
    generoso = await _publicar(client, headers, _payload("160000"))

    worker = await auth_headers(client, "worker", "bench_w1@staffya.com")
    await client.post("/api/v1/workers/me/profile", headers=worker, json={"skills": ["mozo"]})

    feed = await client.get("/api/v1/shifts/feed", headers=worker)
    assert feed.status_code == 200
    shift = next(s for s in feed.json() if s["id"] == generoso)
    assert shift["pay_band"] == "por_encima"


async def test_sin_ciudad_no_se_compara_contra_nada(client: AsyncClient):
    """Comparar un turno sin ciudad contra la mediana del país entero no dice
    nada útil: preferimos no responder."""
    headers = await _employer(client, "bench_emp4@staffya.com")
    for _ in range(MIN_SAMPLE_SIZE):
        await _publicar(client, headers, _payload("80000"))
    sin_ciudad = await _publicar(client, headers, _payload("40000", city=None))

    mine = await client.get("/api/v1/shifts/me", headers=headers)
    shift = next(s for s in mine.json() if s["id"] == sin_ciudad)
    assert shift["pay_band"] is None


@pytest.mark.parametrize("otra_ciudad", ["Belgrano", "Rosario"])
async def test_la_referencia_es_por_ciudad(client: AsyncClient, otra_ciudad: str):
    """Lo que se paga en un barrio no es lo que se paga en otro: un turno de
    otra ciudad no debe heredar la referencia de Palermo."""
    headers = await _employer(client, f"bench_{otra_ciudad.lower()}@staffya.com")
    for _ in range(MIN_SAMPLE_SIZE):
        await _publicar(client, headers, _payload("80000", city="Palermo"))
    afuera = await _publicar(client, headers, _payload("40000", city=otra_ciudad))

    mine = await client.get("/api/v1/shifts/me", headers=headers)
    shift = next(s for s in mine.json() if s["id"] == afuera)
    assert shift["pay_band"] is None
