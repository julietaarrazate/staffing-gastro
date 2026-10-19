"""Cierre de la conexión ociosa del pool (`core/database.py`, 2026-10-13):
con Render siempre prendido, la conexión que deja `pool_size=1` no debe
quedar abierta cuando nadie usa la app, para que Neon pueda dormirse."""

import time

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core import database

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def file_engine(tmp_path, monkeypatch):
    # SQLite en archivo usa un QueuePool, como el engine real contra Neon
    # (el `:memory:` de los otros tests usa un pool de una sola conexión fija).
    eng = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'idle.db'}", pool_size=1)
    database.track_pool_use(eng)
    monkeypatch.setattr(database, "engine", eng)
    yield eng
    await eng.dispose()


async def _query(eng) -> None:
    async with eng.connect() as conn:
        await conn.execute(text("SELECT 1"))


async def test_cierra_la_conexion_tras_el_hueco(file_engine):
    await _query(file_engine)
    assert file_engine.pool.checkedin() == 1

    closed = await database.close_idle_connections(
        now=time.monotonic() + database.IDLE_CLOSE_AFTER + 1
    )

    assert closed is True
    assert file_engine.pool.checkedin() == 0


async def test_no_la_cierra_si_se_uso_hace_poco(file_engine):
    await _query(file_engine)

    assert await database.close_idle_connections() is False
    assert file_engine.pool.checkedin() == 1


async def test_no_la_cierra_si_hay_una_prestada(file_engine):
    async with file_engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
        closed = await database.close_idle_connections(
            now=time.monotonic() + database.IDLE_CLOSE_AFTER + 1
        )
        assert closed is False


async def test_despues_de_cerrar_sigue_funcionando_y_anotando_el_uso(file_engine):
    await _query(file_engine)
    await database.close_idle_connections(
        now=time.monotonic() + database.IDLE_CLOSE_AFTER + 1
    )

    antes = database._last_pool_use
    await _query(file_engine)  # abre una conexión nueva en el pool nuevo

    assert database._last_pool_use > antes
    assert file_engine.pool.checkedin() == 1


async def test_fuera_de_produccion_no_arranca():
    assert database.start_idle_connection_closer() is None
