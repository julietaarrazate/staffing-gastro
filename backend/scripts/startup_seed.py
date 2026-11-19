"""Tareas de siembra en el arranque, para correr en el `CMD` del contenedor
después de las migraciones. Todo acá es idempotente y NUNCA bloquea el
arranque del servidor: si algo falla, lo registra y sigue.

Son DOS cosas distintas, con reglas distintas a propósito:

1. **Fotos de las 4 cuentas compartidas** (invitado + prueba): corren
   SIEMPRE. No dependen de ningún flag — ver `seed_shared_account_photos`.
2. **Datos demo** (~26 cuentas con contraseña pública + turnos): sólo con
   `SEED_DEMO_DATA=true` (ver `render.yaml`) y nunca en producción.

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
    # Con la beta abierta (fase 0 del plan de crecimiento, 2026-11-19) la
    # siembra demo no corre en producción aunque el flag quede prendido: son
    # ~26 cuentas con contraseña pública conocida y turnos que verían los
    # usuarios reales. Antes sólo avisaba; el flag ya estaba en `false` desde
    # el 2026-10-22 (runbook 'Apagar el modo demo' en docs/reference/DEPLOY.md).
    if os.getenv("ENVIRONMENT", "").strip().lower() == "production":
        print(
            "[seed] ALERTA: SEED_DEMO_DATA=true en ENVIRONMENT=production — "
            "NO se siembran cuentas demo en la base real. Poné "
            "SEED_DEMO_DATA=false en Render (ver runbook 'Apagar el modo demo' "
            "en docs/reference/DEPLOY.md)."
        )
        return
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
