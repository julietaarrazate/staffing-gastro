"""La suscripción se guarda sólo si nadie la cambió desde que se leyó (CON-08,
2026-11-19).

Antes `SqlAlchemySubscriptionRepository.update` reescribía plan, estado,
período, `paid_until`, `renews`, aviso y contador desde la copia leída: la
pasada de vencimiento dejaba «vencida» a un comercio que pagó mientras
corría, una baja se comía un mes pago (o el pago la baja) y dos
publicaciones a la vez contaban una sola. Ahora el UPDATE es condicional y
cada caso de uso relee y vuelve a aplicar su regla si perdió. Las carreras
se simulan con dos sesiones de base, cada una con su lectura.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base

from app.modules.subscription.application.services import SubscriptionService
from app.modules.subscription.domain.entities import GRACE_PERIOD
from app.modules.subscription.domain.exceptions import SubscriptionChangedError
from app.modules.subscription.domain.repositories import change_subscription
from app.modules.subscription.infrastructure.models import SubscriptionModel
from app.modules.subscription.infrastructure.repositories import (
    SqlAlchemySubscriptionPaymentRepository,
    SqlAlchemySubscriptionRepository,
)
from tests.test_attendance import _employer_with_company, _shift_payload
from tests.test_subscription_cobro import (  # noqa: F401 (fixture)
    _checkout,
    _employer,
    _mp_payment,
    _notify,
    billing_on,
)

pytestmark = pytest.mark.asyncio


async def _sub(client: AsyncClient, headers: dict) -> dict:
    return (await client.get("/api/v1/subscription", headers=headers)).json()


async def _paid_until(client: AsyncClient, headers: dict) -> datetime:
    value = datetime.fromisoformat((await _sub(client, headers))["paid_until"])
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def test_el_vencimiento_no_pisa_un_pago_que_entro_en_el_medio(
    client: AsyncClient, billing_on, session_factory, monkeypatch
):
    headers = await _employer(client, "con08_venc@oido.com.ar")
    first = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, first, "venc-mes-1")
    await _notify(client, "venc-mes-1")
    paid_until = await _paid_until(client, headers)
    second = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, second, "venc-mes-2")

    original_list = SqlAlchemySubscriptionRepository.list_paid
    pago_entro = False

    async def list_paid(self):
        nonlocal pago_entro
        leidas = await original_list(self)
        if not pago_entro:
            pago_entro = True
            # La pasada ya tiene su copia; el comercio paga el mes 2 ahora.
            ok = await _notify(client, "venc-mes-2")
            assert ok.json()["result"] == "aprobado"
        return leidas

    monkeypatch.setattr(SqlAlchemySubscriptionRepository, "list_paid", list_paid)
    async with session_factory() as session:
        service = SubscriptionService(
            subscriptions=SqlAlchemySubscriptionRepository(session),
            billing=billing_on,
            payments=SqlAlchemySubscriptionPaymentRepository(session),
        )
        cuando = paid_until + GRACE_PERIOD + timedelta(minutes=1)
        next_deadline = await service.run_expiry_check(cuando)
    # La pasada salteó la que cambió y pide volver a mirar enseguida.
    assert next_deadline is not None
    assert next_deadline <= cuando.replace(tzinfo=None)

    sub = await _sub(client, headers)
    assert sub["status"] == "activa", sub["status"]
    assert await _paid_until(client, headers) > paid_until


async def test_dar_de_baja_mientras_entra_un_pago_no_pierde_ninguno_de_los_dos(
    client: AsyncClient, billing_on, monkeypatch
):
    headers = await _employer(client, "con08_baja@oido.com.ar")
    first = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, first, "baja-mes-1")
    await _notify(client, "baja-mes-1")
    paid_until = await _paid_until(client, headers)
    second = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, second, "baja-mes-2")

    original = SqlAlchemySubscriptionRepository.update
    pago_entro = False

    async def update(self, subscription):
        nonlocal pago_entro
        if not pago_entro and subscription.renews is False:
            pago_entro = True
            # «Dar de baja» ya leyó la suscripción; antes de que guarde, entra
            # el pago del mes 2 (que vuelve a poner `renews`).
            ok = await _notify(client, "baja-mes-2")
            assert ok.json()["result"] == "aprobado"
        return await original(self, subscription)

    monkeypatch.setattr(SqlAlchemySubscriptionRepository, "update", update)
    baja = await client.post("/api/v1/subscription/cancel-renewal", headers=headers)
    assert baja.status_code == 200, baja.text

    sub = await _sub(client, headers)
    # La baja se aplicó sobre el estado nuevo: no renueva, y el mes pagado
    # en el medio sigue acreditado.
    assert sub["renews"] is False
    assert sub["status"] == "activa"
    assert await _paid_until(client, headers) > paid_until


async def test_dos_publicaciones_a_la_vez_cuentan_las_dos(client: AsyncClient, monkeypatch):
    headers = await _employer_with_company(client, "con08_pub@staffya.com")
    turnos = []
    for _ in range(2):
        created = await client.post("/api/v1/shifts", headers=headers, json=_shift_payload())
        assert created.status_code == 201, created.text
        turnos.append(created.json()["id"])

    original = SqlAlchemySubscriptionRepository.register_publication
    otra_publicacion = True

    async def register_publication(self, company_id, now):
        nonlocal otra_publicacion
        if otra_publicacion:
            otra_publicacion = False
            # La primera publicación ya leyó la suscripción; antes de que
            # sume, se publica el otro turno del mismo comercio.
            res = await client.post(f"/api/v1/shifts/{turnos[1]}/publish", headers=headers)
            assert res.status_code == 200, res.text
        return await original(self, company_id, now)

    monkeypatch.setattr(
        SqlAlchemySubscriptionRepository, "register_publication", register_publication
    )
    res = await client.post(f"/api/v1/shifts/{turnos[0]}/publish", headers=headers)
    assert res.status_code == 200, res.text

    assert (await _sub(client, headers))["turnos_usados_mes"] == 2


async def _company_with_subscription(client: AsyncClient, factory, email: str):
    headers = await _employer_with_company(client, email)
    company_id = (await client.get("/api/v1/companies/me/profile", headers=headers)).json()["id"]
    async with factory() as s:
        await SqlAlchemySubscriptionRepository(s).get_or_create(UUID(company_id))
    return UUID(company_id)


async def test_cinco_publicaciones_simultaneas_en_sesiones_reales_suman_cinco(tmp_path):
    """Cinco sesiones con su propia conexión (SQLite en archivo) suman a la
    vez: con leer, sumar y guardar se perdía alguna; en la base no."""
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{tmp_path}/contador.db", connect_args={"timeout": 30}
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    company_id = uuid4()
    async with factory() as s:
        await SqlAlchemySubscriptionRepository(s).get_or_create(company_id)

    async def publicar():
        async with factory() as s:
            await SqlAlchemySubscriptionRepository(s).register_publication(
                company_id, datetime.now(UTC)
            )

    await asyncio.gather(*(publicar() for _ in range(5)))
    async with factory() as s:
        sub = await SqlAlchemySubscriptionRepository(s).get_by_company_id(company_id)
    await engine.dispose()
    assert sub.turnos_usados_mes == 5


async def test_la_publicacion_que_encuentra_la_ventana_vencida_abre_una_nueva(
    client: AsyncClient, session_factory
):
    company_id = await _company_with_subscription(client, session_factory, "con08_ventana@staffya.com")
    ahora = datetime.now(UTC)
    async with session_factory() as s:
        await s.execute(
            update(SubscriptionModel)
            .where(SubscriptionModel.company_id == company_id)
            .values(
                period_start=ahora - timedelta(days=40),
                period_end=ahora - timedelta(days=10),
                turnos_usados_mes=7,
            )
        )
        await s.commit()

    async with session_factory() as s:
        repo = SqlAlchemySubscriptionRepository(s)
        await repo.register_publication(company_id, ahora)
        await repo.register_publication(company_id, ahora)
        sub = await repo.get_by_company_id(company_id)
    assert sub.turnos_usados_mes == 2
    assert sub.period_end.replace(tzinfo=None) > ahora.replace(tzinfo=None)


async def test_una_lectura_vieja_no_se_guarda_y_change_subscription_relee(
    client: AsyncClient, session_factory
):
    headers = await _employer_with_company(client, "con08_repo@staffya.com")
    company_id = (await client.get("/api/v1/companies/me/profile", headers=headers)).json()["id"]
    async with session_factory() as s:
        await SqlAlchemySubscriptionRepository(s).get_or_create(company_id)

    async with session_factory() as a, session_factory() as b:
        repo_a, repo_b = SqlAlchemySubscriptionRepository(a), SqlAlchemySubscriptionRepository(b)
        vieja = await repo_b.get_by_company_id(company_id)
        leida = await repo_a.get_by_company_id(company_id)
        leida.register_publication()
        await repo_a.update(leida)

        # Guardar la copia vieja no pisa lo nuevo.
        vieja.register_publication()
        with pytest.raises(SubscriptionChangedError):
            await repo_b.update(vieja)

        # `change_subscription` relee y suma sobre lo nuevo.
        lecturas = [await repo_b.get_by_company_id(company_id)]
        await repo_a.update(await _sumar_uno(repo_a, company_id))

        async def load():
            return lecturas.pop() if lecturas else await repo_b.get_by_company_id(company_id)

        guardada = await change_subscription(
            repo_b, load, lambda sub: sub.register_publication()
        )
    assert guardada.turnos_usados_mes == 3


async def _sumar_uno(repo: SqlAlchemySubscriptionRepository, company_id):
    sub = await repo.get_by_company_id(company_id)
    sub.register_publication()
    return sub


async def test_si_pierde_todas_las_veces_responde_409_sin_guardar(
    client: AsyncClient, billing_on, monkeypatch
):
    headers = await _employer(client, "con08_409@oido.com.ar")
    first = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, first, "c409-mes-1")
    await _notify(client, "c409-mes-1")

    async def siempre_cambio(self, subscription):
        raise SubscriptionChangedError(str(subscription.id))

    monkeypatch.setattr(SqlAlchemySubscriptionRepository, "update", siempre_cambio)
    baja = await client.post("/api/v1/subscription/cancel-renewal", headers=headers)
    assert baja.status_code == 409
    assert baja.json()["detail"] == "Tu plan cambió mientras tanto. Actualizá y volvé a intentar."
    monkeypatch.undo()
    assert (await _sub(client, headers))["renews"] is True


async def test_un_arrepentimiento_a_medias_se_termina_al_reintentar(
    client: AsyncClient, billing_on, monkeypatch
):
    """El reembolso salió pero el plan no llegó a cortarse (la suscripción
    perdió la carrera de guardado las tres veces): al reintentar se termina
    la baja, sin reembolsar dos veces, en vez de «no disponible»."""
    headers = await _employer(client, "con08_arrep@oido.com.ar")
    first = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, first, "arrep-mes-1")
    await _notify(client, "arrep-mes-1")

    async def siempre_cambio(self, subscription):
        raise SubscriptionChangedError(str(subscription.id))

    monkeypatch.setattr(SqlAlchemySubscriptionRepository, "update", siempre_cambio)
    primero = await client.post("/api/v1/subscription/withdraw", headers=headers)
    assert primero.status_code == 409
    monkeypatch.undo()
    assert billing_on.refunds == ["arrep-mes-1"]
    a_medias = await _sub(client, headers)
    assert a_medias["status"] == "activa"
    # La pantalla sigue ofreciendo «Arrepentirme» para terminarlo.
    assert a_medias["withdrawal_until"] is not None

    reintento = await client.post("/api/v1/subscription/withdraw", headers=headers)
    assert reintento.status_code == 200, reintento.text
    assert reintento.json()["status"] == "cancelada"
    assert billing_on.refunds == ["arrep-mes-1"]  # no se devolvió dos veces
    final = await _sub(client, headers)
    assert final["withdrawal_until"] is None
    assert (await client.post("/api/v1/subscription/withdraw", headers=headers)).status_code == 409

