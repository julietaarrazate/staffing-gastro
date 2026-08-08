"""Casos de uso del módulo de identidad.

Orquesta dominio + puertos (repositorio) + utilidades de seguridad.
No conoce detalles de HTTP ni de SQLAlchemy.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import jwt

from app.core.config import settings
from app.core.security import (
    ACCESS_TOKEN,
    REFRESH_TOKEN,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.identity.application.dtos import (
    GoogleLoginCommand,
    GoogleLoginResult,
    GoogleRoleRequired,
    LoginCommand,
    RegisterCommand,
    TokenPair,
)
from app.modules.identity.domain.entities import (
    EmailVerificationToken,
    PasswordResetToken,
    RefreshSession,
    User,
)
from app.modules.identity.domain.exceptions import (
    EmailAlreadyExistsError,
    EmailVerificationTokenInvalidError,
    GoogleEmailNotVerifiedError,
    InactiveUserError,
    InvalidCredentialsError,
    InvalidGuestPinError,
    InvalidTokenError,
    PasswordResetTokenInvalidError,
    RefreshTokenRevokedError,
    UserNotFoundError,
)
from app.modules.identity.domain.google_verifier import GoogleTokenVerifier
from app.modules.identity.domain.repositories import (
    EmailVerificationTokenRepository,
    PasswordResetTokenRepository,
    RefreshSessionRepository,
    UserRepository,
)
from app.modules.identity.domain.value_objects import UserRole
from app.modules.notification.domain.email_sender import EmailSender

logger = logging.getLogger(__name__)

# --- Acceso de invitado para la beta ("Explorar sin cuenta") --------------
# PIN pensado para que un grupo cerrado de testers entre a probar la app sin
# registrarse. Se configura ACÁ, en el código (no es una env var, a pedido de
# la operadora: "algo simple que puedas configurar, sin variables").
#
#   👉 Para cambiar el PIN, editá esta constante y nada más.
#
# OJO (honestidad): si el repositorio es público, este valor queda visible en
# el código. Es un gate liviano para una beta con amigos, NO una credencial
# fuerte. Para seguridad real, moverlo a una env var. El rate-limit por IP del
# endpoint (ver api/routes.py) frena la fuerza bruta.
GUEST_ACCESS_PIN = "3526"

# Cuentas invitadas compartidas (una por rol), creadas on-demand la primera vez
# que alguien entra con el PIN. Son sandboxes COMPARTIDOS: todos los testers de
# un mismo rol usan la misma cuenta (suficiente para "que mis amigos prueben").
_GUEST_ACCOUNTS: dict[UserRole, tuple[str, str]] = {
    UserRole.WORKER: ("invitado.trabajador@oido.beta", "Invitado · Trabajador"),
    UserRole.EMPLOYER: ("invitado.comercio@oido.beta", "Invitado · Comercio"),
}

# Emails de las cuentas invitado, expuestos para que otros módulos puedan
# excluirlas de resultados pensados para usuarios reales (p. ej. el trabajador
# invitado no debe aparecer en /matching/search ni en el mapa de un comercio
# real — pedido de Julieta tras verlo mezclado con trabajadores reales en QA).
# Su propia exploración de /search o /map no se ve afectada: ese filtro sólo
# saca la cuenta invitado de los RESULTADOS, no le cambia lo que ella ve.
GUEST_ACCOUNT_EMAILS: frozenset[str] = frozenset(
    email for email, _ in _GUEST_ACCOUNTS.values()
)

# Vigencia del token de recuperación de contraseña.
PASSWORD_RESET_TOKEN_TTL = timedelta(hours=1)
# Rate-limit silencioso de reenvío: si ya hay un token vigente creado hace
# menos de esta ventana, no se genera/manda otro (ver `request_password_reset`).
PASSWORD_RESET_RESEND_WINDOW = timedelta(minutes=5)

# Vigencia del token de verificación de email — más larga que la de reset de
# contraseña (48hs, no 1h): a diferencia de un reset, nadie lo pide con
# urgencia, y no queremos que alguien que se registró y no revisó el mail
# enseguida tenga que reenviarse el link.
EMAIL_VERIFICATION_TOKEN_TTL = timedelta(hours=48)
EMAIL_VERIFICATION_RESEND_WINDOW = timedelta(minutes=5)


class IdentityService:
    """Servicio de aplicación que agrupa los casos de uso de autenticación."""

    def __init__(
        self,
        users: UserRepository,
        sessions: RefreshSessionRepository,
        password_reset_tokens: PasswordResetTokenRepository,
        email_sender: EmailSender,
        google_verifier: GoogleTokenVerifier,
        email_verification_tokens: EmailVerificationTokenRepository | None = None,
    ) -> None:
        self._users = users
        self._sessions = sessions
        self._reset_tokens = password_reset_tokens
        self._email_sender = email_sender
        self._google_verifier = google_verifier
        self._verification_tokens = email_verification_tokens

    async def register(self, command: RegisterCommand) -> User:
        """Registra un nuevo usuario. Falla si el email ya existe.

        Best-effort: si se cablearon `email_verification_tokens`, dispara el
        email de verificación (nunca bloquea el registro si el envío falla,
        mismo contrato que el resto de los emails transaccionales)."""
        if await self._users.exists_by_email(command.email):
            raise EmailAlreadyExistsError(command.email)

        user = User(
            email=command.email.lower(),
            hashed_password=hash_password(command.password),
            full_name=command.full_name,
            role=command.role,
        )
        created = await self._users.add(user)
        if self._verification_tokens is not None:
            await self._send_verification_email(created)
        return created

    async def authenticate(self, command: LoginCommand) -> TokenPair:
        """Valida credenciales y devuelve un par de tokens."""
        user = await self._users.get_by_email(command.email)
        if user is None or not verify_password(command.password, user.hashed_password):
            raise InvalidCredentialsError()
        if not user.is_active:
            raise InactiveUserError()
        return await self._issue_tokens(user)

    async def guest_login(self, pin: str, role: UserRole) -> TokenPair:
        """Acceso de invitado (beta): valida el PIN configurado en código y
        entra en la cuenta invitada compartida del rol pedido, creándola la
        primera vez. El tester sólo pone el PIN — nunca se exponen
        credenciales, y la cuenta invitada tiene contraseña imposible (no se
        puede loguear por email/contraseña)."""
        if not secrets.compare_digest(pin, GUEST_ACCESS_PIN):
            raise InvalidGuestPinError()

        email, name = _GUEST_ACCOUNTS[role]
        user = await self._users.get_by_email(email)
        if user is None:
            user = await self._users.add(
                User(
                    email=email,
                    hashed_password=_google_local_password(),
                    full_name=name,
                    role=role,
                    is_verified=True,
                )
            )
        if not user.is_active:
            raise InactiveUserError()
        return await self._issue_tokens(user)

    async def authenticate_google(self, command: GoogleLoginCommand) -> GoogleLoginResult:
        """Ingresa o registra un usuario a partir de un ID token de Google
        (Google Identity Services, ver docs/reference/ACCESO_MODERNO.md).

        - Email ya registrado -> sesión normal (mismos tokens JWT propios).
        - Email nuevo y `command.role` ausente -> `GoogleRoleRequired`: el
          frontend debe preguntar "¿Buscás trabajo o buscás personal?" y
          reintentar con el rol elegido.
        - Email nuevo y `command.role` presente -> se registra la cuenta
          (contraseña local imposible, ver `_google_local_password`) y se
          emiten tokens.
        """
        identity = await self._google_verifier.verify(command.id_token)
        if not identity.email_verified:
            raise GoogleEmailNotVerifiedError()

        email = identity.email.lower()
        user = await self._users.get_by_email(email)
        if user is not None:
            if not user.is_active:
                raise InactiveUserError()
            return await self._issue_tokens(user)

        if command.role is None:
            return GoogleRoleRequired(email=email, full_name=identity.full_name)

        user = User(
            email=email,
            hashed_password=_google_local_password(),
            full_name=identity.full_name,
            role=command.role,
            # Google ya verificó la propiedad del email: no hace falta el
            # flujo de verificación propio para estas cuentas.
            is_verified=True,
        )
        user = await self._users.add(user)
        return await self._issue_tokens(user)

    async def refresh(self, refresh_token: str) -> TokenPair:
        """Emite un nuevo par de tokens a partir de un refresh token válido.

        Rotación (ADR-0002): el refresh usado queda revocado y se emite uno
        nuevo. Si el `jti` recibido ya estaba revocado, se interpreta como
        reuso de un token viejo (posible robo): se revocan **todas** las
        sesiones del usuario y se rechaza la operación.
        """
        jti = self._decode_refresh(refresh_token)

        session = await self._sessions.get_by_jti(jti)
        if session is None:
            raise InvalidTokenError()
        if session.is_revoked:
            await self._sessions.revoke_all_for_user(session.user_id)
            raise RefreshTokenRevokedError()

        user = await self._users.get_by_id(session.user_id)
        if user is None:
            raise UserNotFoundError()
        if not user.is_active:
            raise InactiveUserError()

        await self._sessions.revoke(jti)
        return await self._issue_tokens(user)

    async def logout(self, refresh_token: str) -> None:
        """Revoca la sesión asociada al refresh token dado (cierre de sesión)."""
        jti = self._decode_refresh(refresh_token)
        session = await self._sessions.get_by_jti(jti)
        if session is None:
            raise InvalidTokenError()
        await self._sessions.revoke(jti)

    async def get_current_user(self, access_token: str) -> User:
        """Resuelve el usuario a partir de un access token (para dependencias)."""
        try:
            payload = decode_token(access_token)
        except jwt.PyJWTError as exc:
            raise InvalidTokenError() from exc

        if payload.get("type") != ACCESS_TOKEN:
            raise InvalidTokenError()

        user = await self._users.get_by_id(UUID(payload["sub"]))
        if user is None:
            raise UserNotFoundError()
        if not user.is_active:
            raise InactiveUserError()
        return user

    async def update_full_name(self, user_id: UUID, full_name: str) -> User:
        """Cambia el nombre del usuario autenticado.

        Único dato de identidad editable desde el propio perfil: hoy tanto
        el registro por email como el acceso con Google lo dejan fijo (el que
        cargó al registrarse, o el que vino de la cuenta de Google), sin
        forma de corregirlo (Julieta, 2026-07-30)."""
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise UserNotFoundError()
        user.full_name = full_name.strip()
        return await self._users.update(user)

    async def request_password_reset(self, email: str) -> None:
        """Inicia la recuperación de contraseña (anti-enumeración).

        Nunca revela si el email existe: si no hay usuario, no hace nada. La
        capa de API siempre responde 202 con el mismo body genérico, exista o
        no la cuenta (ver `identity/api/routes.py::forgot_password`). Si el
        usuario ya tiene un token vigente sin usar creado hace menos de
        `PASSWORD_RESET_RESEND_WINDOW`, tampoco genera ni manda uno nuevo
        (rate-limit silencioso de reenvío)."""
        user = await self._users.get_by_email(email)
        if user is None:
            return

        now = datetime.now(timezone.utc)
        latest = await self._reset_tokens.get_latest_unused_for_user(user.id)
        if latest is not None and latest.created_within(PASSWORD_RESET_RESEND_WINDOW, now):
            return

        raw_token = secrets.token_urlsafe(32)
        await self._reset_tokens.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=_hash_token(raw_token),
                expires_at=now + PASSWORD_RESET_TOKEN_TTL,
            )
        )

        link = f"{settings.frontend_url}/restablecer?token={raw_token}"
        html = (
            f"<p>Hola {user.full_name},</p>"
            "<p>Recibimos un pedido para restablecer tu contraseña de Oído. "
            f'Hacé clic en el siguiente enlace para elegir una nueva (vence en 1 hora): '
            f'<a href="{link}">{link}</a></p>'
            "<p>Si vos no lo pediste, podés ignorar este email.</p>"
        )
        try:
            await self._email_sender.send(
                to=user.email,
                subject="Restablecé tu contraseña de Oído",
                html=html,
            )
        except Exception:
            # El envío es best-effort: nunca debe romper el flujo (el token ya
            # quedó guardado, así que el usuario puede reintentar el pedido).
            logger.exception(
                "No se pudo enviar el email de recuperación de contraseña a %s",
                user.id,
            )

    async def reset_password(self, token: str, new_password: str) -> None:
        """Valida el token de recuperación y establece la nueva contraseña.

        Error genérico (`PasswordResetTokenInvalidError`) tanto si el token no
        existe, expiró o ya se usó — no-disclosure (la API la mapea siempre al
        mismo 400 "Enlace inválido o vencido")."""
        reset_token = await self._reset_tokens.get_by_token_hash(_hash_token(token))
        now = datetime.now(timezone.utc)
        if reset_token is None or not reset_token.is_valid(now):
            raise PasswordResetTokenInvalidError()

        user = await self._users.get_by_id(reset_token.user_id)
        if user is None:
            raise PasswordResetTokenInvalidError()

        user.hashed_password = hash_password(new_password)
        await self._users.update(user)

        await self._reset_tokens.mark_used(reset_token.id)
        await self._reset_tokens.invalidate_all_unused_for_user(user.id)
        # Al cambiar la contraseña se revocan todas las sesiones de refresh
        # activas (OWASP): si alguien tenía una sesión robada, no sobrevive
        # al reset. El usuario vuelve a loguearse con la contraseña nueva.
        await self._sessions.revoke_all_for_user(user.id)

    async def _send_verification_email(self, user: User) -> None:
        """Genera un token nuevo y manda el email de verificación —
        best-effort, nunca rompe el flujo que la llama (registro o reenvío),
        mismo contrato que `request_password_reset`."""
        raw_token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        await self._verification_tokens.add(
            EmailVerificationToken(
                user_id=user.id,
                token_hash=_hash_token(raw_token),
                expires_at=now + EMAIL_VERIFICATION_TOKEN_TTL,
            )
        )
        link = f"{settings.frontend_url}/verificar-email?token={raw_token}"
        html = (
            f"<p>Hola {user.full_name},</p>"
            "<p>Gracias por registrarte en Oído. Confirmá tu email haciendo "
            f'clic en el siguiente enlace (vence en 48 horas): '
            f'<a href="{link}">{link}</a></p>'
            "<p>Si vos no creaste esta cuenta, podés ignorar este email.</p>"
        )
        try:
            await self._email_sender.send(
                to=user.email,
                subject="Confirmá tu email en Oído",
                html=html,
            )
        except Exception:
            logger.exception(
                "No se pudo enviar el email de verificación a %s", user.id
            )

    async def resend_verification_email(self, email: str) -> None:
        """Reenvía el email de verificación (anti-enumeración, igual que
        `request_password_reset`): nunca revela si el email existe o si ya
        estaba verificado, y respeta el mismo rate-limit silencioso."""
        if self._verification_tokens is None:
            return
        user = await self._users.get_by_email(email)
        if user is None or user.is_verified:
            return

        now = datetime.now(timezone.utc)
        latest = await self._verification_tokens.get_latest_unused_for_user(user.id)
        if latest is not None and latest.created_within(
            EMAIL_VERIFICATION_RESEND_WINDOW, now
        ):
            return
        await self._send_verification_email(user)

    async def verify_email(self, token: str) -> None:
        """Valida el token de verificación y marca al usuario como
        verificado. Mismo no-disclosure que `reset_password`: un error
        genérico tanto si el token no existe, expiró o ya se usó."""
        if self._verification_tokens is None:
            raise EmailVerificationTokenInvalidError()
        verification_token = await self._verification_tokens.get_by_token_hash(
            _hash_token(token)
        )
        now = datetime.now(timezone.utc)
        if verification_token is None or not verification_token.is_valid(now):
            raise EmailVerificationTokenInvalidError()

        user = await self._users.get_by_id(verification_token.user_id)
        if user is None:
            raise EmailVerificationTokenInvalidError()

        if not user.is_verified:
            user.verify()
            await self._users.update(user)
        await self._verification_tokens.mark_used(verification_token.id)

    async def _issue_tokens(self, user: User) -> TokenPair:
        """Emite un par de tokens y persiste la sesión del refresh (ADR-0002)."""
        jti = str(uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.refresh_token_expire_days
        )
        await self._sessions.add(
            RefreshSession(user_id=user.id, jti=jti, expires_at=expires_at)
        )
        claims = {"role": user.role.value}
        return TokenPair(
            access_token=create_access_token(str(user.id), extra_claims=claims),
            refresh_token=create_refresh_token(str(user.id), jti=jti),
            user=user,
        )

    @staticmethod
    def _decode_refresh(refresh_token: str) -> str:
        """Decodifica un refresh token y devuelve su `jti`, o lanza InvalidTokenError."""
        try:
            payload = decode_token(refresh_token)
        except jwt.PyJWTError as exc:
            raise InvalidTokenError() from exc

        if payload.get("type") != REFRESH_TOKEN:
            raise InvalidTokenError()

        jti = payload.get("jti")
        if not jti:
            raise InvalidTokenError()
        return jti


def _hash_token(raw_token: str) -> str:
    """sha256 de un token de un solo uso (recuperación de contraseña o
    verificación de email): nunca se persiste ni se busca por el valor en
    claro (sólo viaja en el link del email)."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _google_local_password() -> str:
    """Contraseña local "imposible" para una cuenta creada vía Google.

    `UserModel.hashed_password` es `NOT NULL` (columna compartida con el
    login por contraseña, ver `infrastructure/models.py`): en vez de agregar
    una migración para volverla nullable y ramificar `authenticate`/
    `reset_password` en "con o sin contraseña", se guarda el hash bcrypt de
    un secreto aleatorio de 32 bytes que nunca se persiste ni se revela.
    Nadie puede loguearse con contraseña porque nadie conoce el secreto —
    el efecto es el mismo que "sin contraseña", sin tocar el esquema.
    El usuario puede pedir "Olvidé mi contraseña" más adelante y setear una
    propia sin cambios adicionales (el flujo de reset ya no le importa el
    hash anterior). Ver docs/reference/ACCESO_MODERNO.md.
    """
    return hash_password(secrets.token_urlsafe(32))
