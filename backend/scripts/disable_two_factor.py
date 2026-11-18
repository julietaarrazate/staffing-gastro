"""Plan B: apaga la verificación en dos pasos de una cuenta (ADR-0023).

Para cuando una admin perdió el celular **y** los códigos de recuperación, y
no hay otra forma de entrar. No hay endpoint para esto a propósito: lo corre
quien tiene acceso a la base (Julieta, con la `DATABASE_URL` de Neon).

Borra el secreto, los códigos de recuperación y los desafíos pendientes, y
cierra todas las sesiones de la cuenta. Al volver a entrar con la
contraseña, el panel le pide activar la verificación de nuevo (con el
celular nuevo).

**Por defecto NO cambia nada** (dry-run): muestra la cuenta y su estado.
Para hacerlo de verdad, `--apply`.

    cd backend
    python -m scripts.disable_two_factor --email hola@oido.com.ar           # sólo mira
    python -m scripts.disable_two_factor --email hola@oido.com.ar --apply   # apaga

Necesita sólo `DATABASE_URL` (no hace falta `TWO_FACTOR_ENCRYPTION_KEY`).
"""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Callable

from app.core.log_privacy import mask_email
from app.modules.identity.application.two_factor import TwoFactorService
from app.modules.identity.infrastructure.fernet_secret_cipher import FernetSecretCipher
from app.modules.identity.infrastructure.repositories import (
    SqlAlchemyRefreshSessionRepository,
    SqlAlchemyUserRepository,
)
from app.modules.identity.infrastructure.two_factor_repositories import (
    SqlAlchemyTwoFactorChallengeRepository,
    SqlAlchemyTwoFactorRepository,
)


async def run(
    session_factory, email: str, *, apply: bool, out: Callable[[str], None] = print
) -> bool:
    """Devuelve True si (con `apply`) apagó una verificación que estaba."""
    async with session_factory() as session:
        user = await SqlAlchemyUserRepository(session).get_by_email(email.strip().lower())
        if user is None:
            out("No hay ninguna cuenta con ese email. No se cambió nada.")
            return False
        two_factor = TwoFactorService(
            SqlAlchemyTwoFactorRepository(session),
            SqlAlchemyTwoFactorChallengeRepository(session),
            # Apagar no cifra ni descifra nada: no hace falta la clave.
            FernetSecretCipher(""),
        )
        status = await two_factor.status(user)
        estado = (
            f"activa desde {status.enabled_at:%Y-%m-%d %H:%M} UTC, "
            f"{status.recovery_codes_left} códigos de recuperación sin usar"
            if status.enabled and status.enabled_at
            else "no activa"
        )
        out(f"Cuenta {mask_email(user.email)} (rol {user.role.value}): verificación {estado}.")
        if not apply:
            out("DRY-RUN: no se cambió nada. Con --apply se apaga y se cierran sus sesiones.")
            return False
        removed = await two_factor.disable(user.id)
        await SqlAlchemyRefreshSessionRepository(session).revoke_all_for_user(user.id)
        out(
            "Listo: verificación apagada y sesiones cerradas. Al entrar con la contraseña, "
            "el panel pide activarla de nuevo."
        )
        return removed


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--email", required=True, help="email de la cuenta")
    parser.add_argument(
        "--apply", action="store_true", help="apagarla de verdad (sin esto, sólo mira)"
    )
    args = parser.parse_args(argv)

    from app.core.database import AsyncSessionLocal

    asyncio.run(run(AsyncSessionLocal, args.email, apply=args.apply))


if __name__ == "__main__":
    main()
