"""Tareas de siembra en el arranque, para correr en el `CMD` del contenedor
después de las migraciones. Todo acá es idempotente y NUNCA bloquea el
arranque del servidor: si algo falla, lo registra y sigue.

Son DOS cosas distintas, con reglas distintas a propósito:

1. **Fotos de las 4 cuentas compartidas** (invitado + prueba): corren
   SIEMPRE. No dependen de ningún flag — ver `seed_shared_account_photos`.
2. **Datos demo** (~26 cuentas con contraseña pública + turnos): sólo con
   `SEED_DEMO_DATA=true` (ver `render.yaml`).

Las dos corren en UN SOLO event loop (`asyncio.run` una vez). El motor de
`app.core.database` es global y su pool guarda las conexiones de asyncpg
atadas al loop que las abrió: con un `asyncio.run` por tarea (como estaba
hasta 2026-09-23), la segunda reusaba la conexión del primer loop, ya
cerrado, y fallaba siempre con "attached to a different loop". El error se
tragaba en el `except` y el log decía `[seed] omitido por error`, así que
los datos demo NUNCA se sembraron en Postgres desde que las fotos se
separaron en su propia tarea (2026-08-16) — en los tests no se ve porque
usan SQLite. Ver docs/BUGS.md.
"""

import asyncio
import os

from app.core.database import engine
from scripts.seed_demo_data import main, seed_shared_account_photos


async def _run_shared_account_photos() -> None:
    """Le da foto a las cuentas invitado/prueba que no tengan.

    Separado del seed demo a propósito (Julieta, 2026-08-16: las
    publicaciones de la cuenta invitado se veían genéricas justamente porque
    el primer intento colgaba de `SEED_DEMO_DATA`, que está apagado). Son
    cuentas que existen igual y no tienen contraseña usable: darles una foto
    no agrega superficie de riesgo, así que no hay motivo para esconderlo
    detrás del flag que protege a las OTRAS 26 cuentas demo.
    """
    try:
        await seed_shared_account_photos()
    except Exception as exc:  # noqa: BLE001 - no queremos tumbar el servidor
        print(f"[seed] fotos de cuentas compartidas omitidas por error: {exc}")


async def _run_demo_data() -> None:
    if os.getenv("SEED_DEMO_DATA", "").lower() != "true":
        print("[seed] SEED_DEMO_DATA != true: no se siembran datos demo")
        return
    # PRODUCTION_HARDENING.md: no apaga el seed (esa sigue siendo decisión de
    # Julieta, ver CLAUDE.md "Pendiente de la operadora") — sólo deja un
    # rastro imposible de pasar por alto en los logs de cada cold start, para
    # que "quedó prendido sin que nadie se diera cuenta" deje de ser posible.
    if os.getenv("ENVIRONMENT", "").lower() == "production":
        print(
            "[seed] ALERTA: SEED_DEMO_DATA=true en ENVIRONMENT=production — "
            "se están (re)sembrando cuentas demo con contraseña pública "
            "conocida en la base real. Ver runbook 'Apagar el modo demo' en "
            "docs/reference/DEPLOY.md antes de onboardear comercios reales."
        )
    try:
        await main()
    except Exception as exc:  # noqa: BLE001 - no queremos tumbar el servidor
        print(f"[seed] omitido por error: {exc}")


async def _run_all() -> None:
    try:
        await _run_shared_account_photos()
        await _run_demo_data()
    finally:
        # Cierra el pool dentro del mismo loop: si no, asyncpg intenta
        # cerrar las conexiones cuando el loop ya no existe.
        await engine.dispose()


def run() -> None:
    asyncio.run(_run_all())


if __name__ == "__main__":
    run()
