"""Tests del arranque de la siembra (`scripts/startup_seed.py`).

La regla que cuidan: TODO el arranque corre en un solo event loop. El motor
de `app.core.database` es global y el pool de asyncpg ata cada conexión al
loop que la abrió; con un `asyncio.run` por tarea, la segunda tarea reusaba
una conexión del loop anterior y fallaba con "attached to a different loop".
El error se tragaba y los datos demo nunca se sembraron en producción
(2026-08-16 → 2026-09-23). Con SQLite no se reproduce, por eso se verifica
la estructura: un solo `asyncio.run`, y el pool cerrado dentro de ese loop.
"""

import asyncio
from types import SimpleNamespace

from scripts import startup_seed


def test_el_arranque_usa_un_solo_event_loop(monkeypatch):
    calls: list[str] = []
    real_run = asyncio.run

    def _counting_run(coro, *args, **kwargs):
        calls.append(coro.__qualname__)
        return real_run(coro, *args, **kwargs)

    async def _noop() -> None:
        return None

    async def _dispose() -> None:
        calls.append("dispose")

    monkeypatch.setattr(startup_seed.asyncio, "run", _counting_run)
    monkeypatch.setattr(startup_seed, "seed_shared_account_photos", _noop)
    monkeypatch.setattr(startup_seed, "main", _noop)
    monkeypatch.setattr(startup_seed, "engine", SimpleNamespace(dispose=_dispose))
    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    monkeypatch.delenv("ENVIRONMENT", raising=False)

    startup_seed.run()

    assert calls == ["_run_all", "dispose"]


def test_si_una_tarea_falla_la_otra_corre_igual_y_no_tumba_el_arranque(monkeypatch, capsys):
    ran: list[str] = []

    async def _boom() -> None:
        raise RuntimeError("se cayó la base")

    async def _demo() -> None:
        ran.append("demo")

    async def _dispose() -> None:
        ran.append("dispose")

    monkeypatch.setattr(startup_seed, "seed_shared_account_photos", _boom)
    monkeypatch.setattr(startup_seed, "main", _demo)
    monkeypatch.setattr(startup_seed, "engine", SimpleNamespace(dispose=_dispose))
    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    monkeypatch.delenv("ENVIRONMENT", raising=False)

    startup_seed.run()

    assert ran == ["demo", "dispose"]
    assert "fotos de cuentas compartidas omitidas por error: se cayó la base" in capsys.readouterr().out


def test_en_produccion_no_siembra_datos_demo_aunque_el_flag_este_prendido(monkeypatch, capsys):
    """Con la beta abierta, `SEED_DEMO_DATA=true` en producción no vuelve a
    crear las cuentas demo de contraseña pública: avisa y sigue. Las fotos de
    las cuentas compartidas sí corren (no dependen del flag)."""
    ran: list[str] = []

    async def _fotos() -> None:
        ran.append("fotos")

    async def _demo() -> None:
        ran.append("demo")

    async def _dispose() -> None:
        ran.append("dispose")

    monkeypatch.setattr(startup_seed, "seed_shared_account_photos", _fotos)
    monkeypatch.setattr(startup_seed, "main", _demo)
    monkeypatch.setattr(startup_seed, "engine", SimpleNamespace(dispose=_dispose))
    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    monkeypatch.setenv("ENVIRONMENT", "production")

    startup_seed.run()

    assert ran == ["fotos", "dispose"]
    assert "NO se siembran cuentas demo en la base real" in capsys.readouterr().out
