"""Tests del script de siembra de datos demo (`scripts/seed_demo_data.py`).

Cubren: 1) que el seed sigue siendo idempotente (no duplica nada en una
segunda corrida) y 2) que esa segunda corrida —el caso real de cada arranque
con `SEED_DEMO_DATA=true` en producción, ver `scripts/startup_seed.py` y
`docs/PERFORMANCE_REPORT.md` § "Seed en cada arranque"— es BARATA: una
consulta por lote (`WHERE email IN (...)`) en vez de un `exists_by_email`
secuencial por cada una de las 26 entradas demo (12 comercios + 14
trabajadores).
"""

from contextlib import contextmanager

import pytest
from sqlalchemy import event, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.modules.identity.infrastructure.models import UserModel
from scripts import seed_demo_data

pytestmark = pytest.mark.asyncio


@contextmanager
def _count_queries(session_factory: async_sessionmaker):
    counter = {"n": 0}
    engine = session_factory.kw["bind"]

    def _on_execute(conn, cursor, statement, parameters, context, executemany):
        counter["n"] += 1

    event.listen(engine.sync_engine, "before_cursor_execute", _on_execute)
    try:
        yield counter
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _on_execute)


async def _user_count(session_factory: async_sessionmaker) -> int:
    async with session_factory() as session:
        result = await session.execute(select(func.count()).select_from(UserModel))
        return result.scalar_one()


async def test_seed_is_idempotent(session_factory, monkeypatch):
    """Correr el seed dos veces no duplica usuarios (mismo comportamiento de
    siempre: `EmailAlreadyExistsError`/chequeo batch hacen que la segunda
    corrida no cree nada nuevo)."""
    monkeypatch.setattr(seed_demo_data, "AsyncSessionLocal", session_factory)

    await seed_demo_data.main()
    n_companies = len(seed_demo_data.COMPANIES)
    n_workers = len(seed_demo_data.WORKERS)
    first_run_count = await _user_count(session_factory)
    assert first_run_count == n_companies + n_workers

    await seed_demo_data.main()
    second_run_count = await _user_count(session_factory)
    assert second_run_count == first_run_count


async def test_second_seed_run_is_cheap_regardless_of_demo_size(session_factory, monkeypatch):
    """R-perf (docs/PERFORMANCE_REPORT.md): la segunda corrida (el caso real
    de cada arranque con datos ya sembrados) hace un número de queries
    CONSTANTE — no una por cada una de las 26 entradas demo. Antes de este
    fix eran >= 26 (una `exists_by_email` secuencial por comercio/trabajador,
    todas antes de descartar el turno de siembra por completo)."""
    monkeypatch.setattr(seed_demo_data, "AsyncSessionLocal", session_factory)

    await seed_demo_data.main()  # primera corrida: siembra todo

    with _count_queries(session_factory) as counter:
        await seed_demo_data.main()  # segunda corrida: ya está todo sembrado

    n_demo_entries = len(seed_demo_data.COMPANIES) + len(seed_demo_data.WORKERS)
    assert n_demo_entries >= 26  # documenta el tamaño real del dataset demo

    # 2 queries batch (1 `_existing_emails` para comercios + 1 para
    # trabajadores) + 0 de turnos (el seed de turnos corta apenas ve que no
    # hay comercios nuevos). Se deja margen generoso (<=6) para no acoplar
    # el test a detalles internos menores, pero bien lejos de 26+.
    assert counter["n"] <= 6, (
        f"se esperaban <=6 queries en la segunda corrida (constante, no una "
        f"por cada una de las {n_demo_entries} entradas demo), se hicieron "
        f"{counter['n']}"
    )
