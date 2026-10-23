"""Verificación en dos pasos obligatoria para las cuentas admin (ADR-0023).

Por la API, como lo haría Julieta: alta con QR, login con código, Google,
códigos de recuperación, anti-replay, desafío que vence, topes, el candado
sobre lo de admin y el plan B. Trabajadores y comercios no cambian.
"""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.config import settings
from app.core.rate_limit import reset_all_rate_limiters
from app.main import app
from app.modules.identity.api.dependencies import get_google_verifier
from app.modules.identity.domain.google_verifier import GoogleIdentity, GoogleTokenVerifier
from app.modules.identity.infrastructure.models import (
    TwoFactorChallengeModel,
    TwoFactorRecoveryCodeModel,
    UserTwoFactorModel,
)
from scripts import disable_two_factor
from tests.conftest import (
    DEFAULT_PASSWORD,
    auth_headers,
    current_totp,
    enroll_admin,
    login,
    new_client,
    promote_to_admin,
    refresh_with_cookie,
    register_user,
)

pytestmark = pytest.mark.asyncio

API = "/api/v1"


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _pending_admin(client: AsyncClient, session_factory, email: str) -> dict:
    """Admin recién promovido, sin la verificación: lo que va a pasar con
    Julieta el día del deploy."""
    await register_user(client, email=email, role="employer", full_name="Admin Nueva")
    await promote_to_admin(session_factory, email)
    return _bearer((await login(client, email))["access_token"])


async def _challenge(client: AsyncClient, email: str) -> str:
    response = await client.post(
        f"{API}/auth/login", json={"email": email, "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["two_factor_required"] is True
    assert "access_token" not in body
    return body["challenge_token"]


async def _verify(client: AsyncClient, challenge: str, code: str):
    return await client.post(
        f"{API}/auth/2fa/verify", json={"challenge_token": challenge, "code": code}
    )


# --- Admin sin la verificación: entra, pero sólo puede activarla ----------


@pytest.mark.parametrize(
    "path",
    [
        "/admin/stats",
        "/admin/users",
        "/admin/leads",
        "/identity/claims/pending",
        "/matching/search",
        "/notifications",
    ],
)
async def test_admin_sin_verificacion_recibe_403_con_codigo(client, session_factory, path):
    headers = await _pending_admin(client, session_factory, "pend@oido.com.ar")
    response = await client.get(f"{API}{path}", headers=headers)
    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["code"] == "two_factor_setup_required"
    assert "verificación en dos pasos" in detail["message"]


async def test_admin_sin_verificacion_ve_quien_es_y_su_estado(client, session_factory):
    headers = await _pending_admin(client, session_factory, "pend2@oido.com.ar")
    me = await client.get(f"{API}/auth/me", headers=headers)
    assert me.status_code == 200 and me.json()["role"] == "admin"
    status = await client.get(f"{API}/auth/2fa", headers=headers)
    assert status.json() == {"enabled": False, "enabled_at": None, "recovery_codes_left": 0}


# --- Alta -----------------------------------------------------------------------


async def test_alta_con_qr_codigo_y_codigos_de_recuperacion(client, session_factory):
    headers = await _pending_admin(client, session_factory, "alta@oido.com.ar")
    setup = await client.post(f"{API}/auth/2fa/setup", json={}, headers=headers)
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    assert setup.json()["otpauth_uri"] == (
        f"otpauth://totp/O%C3%ADdo:alta@oido.com.ar?secret={secret}&issuer=O%C3%ADdo"
    )

    wrong = await client.post(f"{API}/auth/2fa/confirm", json={"code": "000000"}, headers=headers)
    assert wrong.status_code == 400

    confirm = await client.post(
        f"{API}/auth/2fa/confirm", json={"code": current_totp(secret)}, headers=headers
    )
    assert confirm.status_code == 200
    body = confirm.json()
    assert len(body["recovery_codes"]) == 10
    assert "staffya_refresh" in confirm.cookies
    assert (
        await client.get(f"{API}/admin/stats", headers=_bearer(body["access_token"]))
    ).status_code == 200

    # En la base: el secreto cifrado y los códigos sólo como hash.
    async with session_factory() as session:
        factor = (await session.execute(select(UserTwoFactorModel))).scalar_one()
        assert factor.secret_encrypted and secret not in factor.secret_encrypted
        assert factor.pending_secret_encrypted is None and factor.enabled_at is not None
        hashes = (
            (await session.execute(select(TwoFactorRecoveryCodeModel.code_hash))).scalars().all()
        )
        assert len(hashes) == 10
        assert not set(hashes) & set(body["recovery_codes"])

    status = await client.get(f"{API}/auth/2fa", headers=_bearer(body["access_token"]))
    assert status.json()["enabled"] is True and status.json()["recovery_codes_left"] == 10


async def test_al_activarla_se_cierran_las_sesiones_de_antes(client, session_factory):
    """Las sesiones abiertas antes de activarla (p. ej. en otro dispositivo,
    o la de alguien con la contraseña) nunca pasaron por un código."""
    email = "previa@oido.com.ar"
    await register_user(client, email=email, role="employer")
    await promote_to_admin(session_factory, email)
    async with new_client() as other_device:
        old = await login(other_device, email)
        old_cookie = other_device.cookies.get("staffya_refresh")

    pending = _bearer((await login(client, email))["access_token"])
    secret = (await client.post(f"{API}/auth/2fa/setup", json={}, headers=pending)).json()["secret"]
    await client.post(
        f"{API}/auth/2fa/confirm", json={"code": current_totp(secret)}, headers=pending
    )

    # El access token viejo: verificación activa pero sesión sin código.
    response = await client.get(f"{API}/admin/stats", headers=_bearer(old["access_token"]))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "two_factor_required"
    # El refresh viejo quedó revocado.
    assert (await refresh_with_cookie(old_cookie)).status_code == 401


async def test_no_admin_no_puede_activarla(client):
    headers = await auth_headers(client, "worker", "mozo2fa@oido.com.ar")
    assert (await client.post(f"{API}/auth/2fa/setup", json={}, headers=headers)).status_code == 403
    assert (await client.get(f"{API}/auth/2fa", headers=headers)).status_code == 403


async def test_sin_clave_de_cifrado_responde_503_y_el_panel_sigue_cerrado(
    client, session_factory, monkeypatch
):
    headers = await _pending_admin(client, session_factory, "sinclave@oido.com.ar")
    monkeypatch.setattr(settings, "two_factor_encryption_key", "")
    setup = await client.post(f"{API}/auth/2fa/setup", json={}, headers=headers)
    assert setup.status_code == 503
    assert setup.json()["detail"]["code"] == "two_factor_not_configured"
    assert (await client.get(f"{API}/admin/stats", headers=headers)).status_code == 403


# --- Login con la verificación activa --------------------------------------


async def test_login_pide_codigo_y_recien_ahi_da_la_sesion(client, session_factory):
    admin = await enroll_admin(client, session_factory, "login@oido.com.ar")
    async with new_client() as device:
        login_response = await device.post(
            f"{API}/auth/login", json={"email": "login@oido.com.ar", "password": DEFAULT_PASSWORD}
        )
        assert "staffya_refresh" not in login_response.cookies
        challenge = login_response.json()["challenge_token"]
        assert login_response.json()["expires_in"] == 300

        bad = await _verify(device, challenge, "000000")
        assert bad.status_code == 401

        ok = await _verify(device, challenge, current_totp(admin["secret"], 1))
        assert ok.status_code == 200
        body = ok.json()
        assert body["user"]["role"] == "admin" and body["used_recovery_code"] is False
        assert "staffya_refresh" in ok.cookies
        assert (
            await device.get(f"{API}/admin/stats", headers=_bearer(body["access_token"]))
        ).status_code == 200

        # La sesión verificada sigue verificada al renovarse.
        refreshed = await device.post(f"{API}/auth/refresh")
        assert refreshed.status_code == 200
        stats = await device.get(
            f"{API}/admin/stats", headers=_bearer(refreshed.json()["access_token"])
        )
        assert stats.status_code == 200

        # El desafío sirve una sola vez.
        again = await _verify(device, challenge, current_totp(admin["secret"], 1))
        assert again.status_code == 401
        assert again.json()["detail"]["code"] == "two_factor_challenge_invalid"


async def test_el_mismo_codigo_no_sirve_dos_veces(client, session_factory):
    admin = await enroll_admin(client, session_factory, "replay@oido.com.ar")
    code = current_totp(admin["secret"], 1)
    assert (
        await _verify(client, await _challenge(client, "replay@oido.com.ar"), code)
    ).status_code == 200
    replay = await _verify(client, await _challenge(client, "replay@oido.com.ar"), code)
    assert replay.status_code == 401
    # El del alta tampoco: ya se usó ese paso.
    old = await _verify(
        client, await _challenge(client, "replay@oido.com.ar"), current_totp(admin["secret"])
    )
    assert old.status_code == 401


async def test_codigo_de_recuperacion_de_un_solo_uso(client, session_factory):
    admin = await enroll_admin(client, session_factory, "recup@oido.com.ar")
    recovery = admin["recovery_codes"][0]
    ok = await _verify(
        client, await _challenge(client, "recup@oido.com.ar"), recovery.upper().replace("-", " ")
    )
    assert ok.status_code == 200
    assert ok.json()["used_recovery_code"] is True
    assert ok.json()["recovery_codes_left"] == 9

    again = await _verify(client, await _challenge(client, "recup@oido.com.ar"), recovery)
    assert again.status_code == 401


async def test_google_tambien_pide_el_codigo(client, session_factory):
    admin = await enroll_admin(client, session_factory, "google@oido.com.ar")

    class _Fake(GoogleTokenVerifier):
        async def verify(self, id_token: str) -> GoogleIdentity:
            return GoogleIdentity(
                email="google@oido.com.ar", email_verified=True, full_name="Admin Google"
            )

    app.dependency_overrides[get_google_verifier] = lambda: _Fake()
    try:
        async with new_client() as device:
            response = await device.post(f"{API}/auth/google", json={"id_token": "tok"})
            assert response.status_code == 200
            body = response.json()
            assert body["two_factor_required"] is True and "access_token" not in body
            assert "staffya_refresh" not in response.cookies
            ok = await _verify(device, body["challenge_token"], current_totp(admin["secret"], 1))
            assert ok.status_code == 200 and ok.json()["user"]["email"] == "google@oido.com.ar"
    finally:
        app.dependency_overrides.pop(get_google_verifier, None)


async def test_desafio_vencido(client, session_factory):
    admin = await enroll_admin(client, session_factory, "vence@oido.com.ar")
    challenge = await _challenge(client, "vence@oido.com.ar")
    async with session_factory() as session:
        await session.execute(
            update(TwoFactorChallengeModel).values(
                expires_at=datetime.now(UTC) - timedelta(seconds=1)
            )
        )
        await session.commit()
    response = await _verify(client, challenge, current_totp(admin["secret"], 1))
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "two_factor_challenge_invalid"


async def test_el_desafio_se_quema_y_la_cuenta_se_traba(client, session_factory):
    admin = await enroll_admin(client, session_factory, "traba@oido.com.ar")
    first = await _challenge(client, "traba@oido.com.ar")
    for _ in range(5):
        assert (await _verify(client, first, "000000")).status_code == 401
    # Quemado: ni con el código bueno.
    burnt = await _verify(client, first, current_totp(admin["secret"], 1))
    assert burnt.json()["detail"]["code"] == "two_factor_challenge_invalid"

    second = await _challenge(client, "traba@oido.com.ar")
    for _ in range(5):
        assert (await _verify(client, second, "111111")).status_code == 401
    # 10 errores en 15 minutos: trabado aunque el desafío sea nuevo.
    locked = await _verify(
        client, await _challenge(client, "traba@oido.com.ar"), current_totp(admin["secret"], 1)
    )
    assert locked.status_code == 429


async def test_limite_por_ip_del_paso_del_codigo(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    reset_all_rate_limiters()
    try:
        statuses = [(await _verify(client, "no-existe", "123456")).status_code for _ in range(11)]
    finally:
        reset_all_rate_limiters()
    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429


# --- Trabajadores y comercios no cambian --------------------------------------


async def test_trabajador_y_comercio_entran_como_siempre(client):
    for role, email in (("worker", "w2fa@oido.com.ar"), ("employer", "e2fa@oido.com.ar")):
        await register_user(client, email=email, role=role)
        body = await login(client, email)
        assert "access_token" in body and "two_factor_required" not in body
        me = await client.get(f"{API}/auth/me", headers=_bearer(body["access_token"]))
        assert me.status_code == 200
        notifications = await client.get(
            f"{API}/notifications", headers=_bearer(body["access_token"])
        )
        assert notifications.status_code == 200


# --- Ajustes: códigos nuevos y cambio de celular ------------------------------


async def test_regenerar_codigos_pide_un_codigo_y_anula_los_anteriores(client, session_factory):
    admin = await enroll_admin(client, session_factory, "regen@oido.com.ar")
    headers = admin["headers"]
    wrong = await client.post(
        f"{API}/auth/2fa/recovery-codes", json={"code": "000000"}, headers=headers
    )
    assert wrong.status_code == 400
    new = await client.post(
        f"{API}/auth/2fa/recovery-codes",
        json={"code": current_totp(admin["secret"], 1)},
        headers=headers,
    )
    assert new.status_code == 200
    codes = new.json()["recovery_codes"]
    assert len(codes) == 10 and not set(codes) & set(admin["recovery_codes"])

    old = await _verify(
        client, await _challenge(client, "regen@oido.com.ar"), admin["recovery_codes"][1]
    )
    assert old.status_code == 401
    fresh = await _verify(client, await _challenge(client, "regen@oido.com.ar"), codes[0])
    assert fresh.status_code == 200


async def test_regenerar_codigos_sin_sesion_verificada_no(client, session_factory):
    headers = await _pending_admin(client, session_factory, "regen2@oido.com.ar")
    response = await client.post(
        f"{API}/auth/2fa/recovery-codes", json={"code": "123456"}, headers=headers
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "two_factor_setup_required"


async def test_cambio_de_celular_tras_entrar_con_codigo_de_recuperacion(client, session_factory):
    """Perdió el celular: entra con un código de recuperación y configura el
    nuevo. El celular viejo deja de servir."""
    admin = await enroll_admin(client, session_factory, "celu@oido.com.ar")
    login_ok = await _verify(
        client, await _challenge(client, "celu@oido.com.ar"), admin["recovery_codes"][0]
    )
    headers = _bearer(login_ok.json()["access_token"])

    # Ya activa: sin un código actual no se puede empezar el cambio.
    no_code = await client.post(f"{API}/auth/2fa/setup", json={}, headers=headers)
    assert no_code.status_code == 400
    setup = await client.post(
        f"{API}/auth/2fa/setup", json={"code": admin["recovery_codes"][1]}, headers=headers
    )
    assert setup.status_code == 200
    new_secret = setup.json()["secret"]
    confirm = await client.post(
        f"{API}/auth/2fa/confirm", json={"code": current_totp(new_secret)}, headers=headers
    )
    assert confirm.status_code == 200
    assert len(confirm.json()["recovery_codes"]) == 10

    old_phone = await _verify(
        client, await _challenge(client, "celu@oido.com.ar"), current_totp(admin["secret"], 1)
    )
    assert old_phone.status_code == 401
    new_phone = await _verify(
        client, await _challenge(client, "celu@oido.com.ar"), current_totp(new_secret, 1)
    )
    assert new_phone.status_code == 200


async def test_cambio_de_celular_con_sesion_sin_codigo_no(client, session_factory):
    """Una sesión de antes de activarla no puede cambiar el celular, ni con
    un código válido."""
    email = "celu2@oido.com.ar"
    await register_user(client, email=email, role="employer")
    await promote_to_admin(session_factory, email)
    async with new_client() as other_device:
        old = _bearer((await login(other_device, email))["access_token"])
    pending = _bearer((await login(client, email))["access_token"])
    setup = await client.post(f"{API}/auth/2fa/setup", json={}, headers=pending)
    secret = setup.json()["secret"]
    confirm = await client.post(
        f"{API}/auth/2fa/confirm", json={"code": current_totp(secret)}, headers=pending
    )
    codes = confirm.json()["recovery_codes"]
    response = await client.post(f"{API}/auth/2fa/setup", json={"code": codes[0]}, headers=old)
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "two_factor_required"


# --- Plan B: script de soporte --------------------------------------------------


async def test_script_mira_por_defecto_y_apaga_con_apply(client, session_factory):
    admin = await enroll_admin(client, session_factory, "planb@oido.com.ar")
    lines: list[str] = []

    removed = await disable_two_factor.run(
        session_factory, "planb@oido.com.ar", apply=False, out=lines.append
    )
    assert removed is False and "DRY-RUN" in lines[-1]
    assert "activa desde" in lines[0]
    assert (await client.get(f"{API}/admin/stats", headers=admin["headers"])).status_code == 200

    removed = await disable_two_factor.run(
        session_factory, "PlanB@oido.com.ar", apply=True, out=lines.append
    )
    assert removed is True
    # La sesión verificada ya no abre el panel: tiene que activarla de nuevo.
    response = await client.get(f"{API}/admin/stats", headers=admin["headers"])
    assert response.json()["detail"]["code"] == "two_factor_setup_required"
    # Entra con la contraseña sola (sin desafío) y sus refresh se cerraron.
    assert "access_token" in await login(client, "planb@oido.com.ar")
    async with session_factory() as session:
        assert (await session.execute(select(UserTwoFactorModel))).first() is None
        assert (await session.execute(select(TwoFactorRecoveryCodeModel))).first() is None


async def test_script_con_email_inexistente(session_factory):
    lines: list[str] = []
    assert (
        await disable_two_factor.run(
            session_factory, "nadie@oido.com.ar", apply=True, out=lines.append
        )
        is False
    )
    assert "No hay ninguna cuenta" in lines[0]
