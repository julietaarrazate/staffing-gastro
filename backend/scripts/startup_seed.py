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
        asyncio.run(main())
    except Exception as exc:  # noqa: BLE001 - no queremos tumbar el servidor
        print(f"[seed] omitido por error: {exc}")


if __name__ == "__main__":
    run()
