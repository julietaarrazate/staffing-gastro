"""El usuario se guarda por columnas, no entero (CON-13, 2026-11-19).

Antes `SqlAlchemyUserRepository.update` reescribía rol, estado, verificado,
nombre y contraseña desde la copia que cada caso de uso había leído: si la
persona se cambiaba el nombre mientras la admin la suspendía, el guardado
del nombre devolvía la cuenta a «activa»; y una contraseña restablecida
mientras corría la suspensión volvía a la vieja. Ahora cada caso de uso
escribe sólo lo que cambió. Las carreras se simulan con dos sesiones de
base, cada una con su lectura.
"""

from uuid import UUID

import pytest
from httpx import AsyncClient

from app.modules.identity.domain.value_objects import UserStatus
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from tests.conftest import auth_headers, make_admin
from tests.test_cuentas_suspendidas import _user_id

pytestmark = pytest.mark.asyncio


async def test_cambiar_el_nombre_mientras_la_suspenden_no_deshace_la_suspension(
    client: AsyncClient, session_factory, monkeypatch
):
    admin = await make_admin(client, session_factory, "con13_admin@staffya.com")
    persona = await auth_headers(client, "worker", "con13_w@staffya.com", "Nombre Viejo")
    user_id = await _user_id(client, admin, "con13_w@staffya.com")

    original = SqlAlchemyUserRepository.update
    ya_suspendida = False

    async def update(self, user):
        nonlocal ya_suspendida
        if not ya_suspendida and user.full_name == "Nombre Nuevo":
            ya_suspendida = True
            # La persona ya leyó su usuario (activo) para cambiarse el nombre;
            # justo antes de guardar, la admin la suspende.
            res = await client.post(f"/api/v1/admin/users/{user_id}/suspend", headers=admin)
            assert res.status_code == 200, res.json()
        return await original(self, user)

    monkeypatch.setattr(SqlAlchemyUserRepository, "update", update)
    cambio = await client.patch(
        "/api/v1/auth/me", headers=persona, json={"full_name": "Nombre Nuevo"}
    )
    monkeypatch.setattr(SqlAlchemyUserRepository, "update", original)
    assert cambio.status_code == 200
    # La respuesta dice cómo quedó la cuenta de verdad.
    assert cambio.json()["status"] == "suspended"

    ficha = (await client.get(f"/api/v1/admin/users/{user_id}", headers=admin)).json()
    usuario = ficha.get("user", ficha)
    assert usuario["status"] == "suspended"
    assert usuario["full_name"] == "Nombre Nuevo"


async def test_suspender_mientras_restablece_la_contrasena_no_vuelve_a_la_vieja(
    client: AsyncClient, session_factory
):
    """Al revés: `suspend_user` lee al usuario, recorre sus turnos (puede
    tardar) y recién después guarda; un restablecimiento de contraseña que
    entra en ese hueco se mantiene."""
    admin = await make_admin(client, session_factory, "con13b_admin@staffya.com")
    await auth_headers(client, "worker", "con13b_w@staffya.com")
    user_id = UUID(await _user_id(client, admin, "con13b_w@staffya.com"))

    async with session_factory() as s_admin, session_factory() as s_persona:
        para_suspender = await SqlAlchemyUserRepository(s_admin).get_by_id(user_id)
        persona = await SqlAlchemyUserRepository(s_persona).get_by_id(user_id)
        persona.hashed_password = "hash-de-la-contrasena-nueva"
        await SqlAlchemyUserRepository(s_persona).update(persona)

        para_suspender.suspend()
        guardado = await SqlAlchemyUserRepository(s_admin).update(para_suspender)

    assert guardado.status == UserStatus.SUSPENDED
    assert guardado.hashed_password == "hash-de-la-contrasena-nueva"
    async with session_factory() as s:
        final = await SqlAlchemyUserRepository(s).get_by_id(user_id)
    assert final.status == UserStatus.SUSPENDED
    assert final.hashed_password == "hash-de-la-contrasena-nueva"


async def test_guardar_dos_veces_la_misma_entidad_no_reescribe_lo_ya_guardado(
    client: AsyncClient, session_factory
):
    """Después de guardar, lo escrito pasa a ser lo leído: un segundo guardado
    de la misma entidad sin cambios nuevos no pisa lo que otro escribió en el
    medio."""
    admin = await make_admin(client, session_factory, "con13c_admin@staffya.com")
    await auth_headers(client, "worker", "con13c_w@staffya.com", "Nombre Viejo")
    user_id = UUID(await _user_id(client, admin, "con13c_w@staffya.com"))

    async with session_factory() as s_persona:
        repo = SqlAlchemyUserRepository(s_persona)
        persona = await repo.get_by_id(user_id)
        persona.full_name = "Nombre Nuevo"
        await repo.update(persona)

        async with session_factory() as s_admin:
            otra = await SqlAlchemyUserRepository(s_admin).get_by_id(user_id)
            otra.suspend()
            await SqlAlchemyUserRepository(s_admin).update(otra)

        persona.verify()
        guardado = await repo.update(persona)

    assert guardado.status == UserStatus.SUSPENDED
    assert guardado.full_name == "Nombre Nuevo"
    assert guardado.is_verified is True
