"""Tareas de siembra en el arranque, para correr en el `CMD` del contenedor
después de las migraciones. Todo acá es idempotente y NUNCA bloquea el
arranque del servidor: si algo falla, lo registra y sigue.

Son DOS cosas distintas, con reglas distintas a propósito:

1. **Fotos de las 4 cuentas compartidas** (invitado + prueba): corren
   SIEMPRE. No dependen de ningún flag — ver `seed_shared_account_photos`.
2. **Datos demo** (~26 cuentas con contraseña pública + turnos): sólo con
   `SEED_DEMO_DATA=true`, que en `render.yaml` está en `"false"`.
"""

import asyncio
import os

from scripts.seed_demo_data import main, seed_shared_account_photos


def _run_shared_account_photos() -> None:
    """Le da foto a las cuentas invitado/prueba que no tengan.

    Separado del seed demo a propósito (Julieta, 2026-08-16: las
    publicaciones de la cuenta invitado se veían genéricas justamente porque
    el primer intento colgaba de `SEED_DEMO_DATA`, que está apagado). Son
    cuentas que existen igual y no tienen contraseña usable: darles una foto
    no agrega superficie de riesgo, así que no hay motivo para esconderlo
    detrás del flag que protege a las OTRAS 26 cuentas demo.
    """
    try:
        asyncio.run(seed_shared_account_photos())
    except Exception as exc:  # noqa: BLE001 - no queremos tumbar el servidor
        print(f"[seed] fotos de cuentas compartidas omitidas por error: {exc}")


def _run_demo_data() -> None:
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


def run() -> None:
    _run_shared_account_photos()
    _run_demo_data()


if __name__ == "__main__":
    run()
