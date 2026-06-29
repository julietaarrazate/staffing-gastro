"""Siembra datos demo en el arranque si `SEED_DEMO_DATA=true`.

Pensado para correr en el `CMD` del contenedor, después de las migraciones.
Es idempotente (el seed omite lo que ya existe) y NUNCA bloquea el arranque del
servidor: si algo falla, lo registra y sigue.
"""

import asyncio
import os

from scripts.seed_demo_data import main


def run() -> None:
    if os.getenv("SEED_DEMO_DATA", "").lower() != "true":
        print("[seed] SEED_DEMO_DATA != true: no se siembran datos demo")
        return
    try:
        asyncio.run(main())
    except Exception as exc:  # noqa: BLE001 - no queremos tumbar el servidor
        print(f"[seed] omitido por error: {exc}")


if __name__ == "__main__":
    run()
