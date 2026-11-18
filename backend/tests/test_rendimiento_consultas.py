"""Guardia de rendimiento: la cantidad de consultas SQL de cada endpoint caliente
NO debe crecer con la cantidad de filas (N+1).

Se siembra un mundo chico (N=2), se cuentan las consultas de un GET, se agregan
filas hasta N=10 y se vuelve a contar. Las dos cuentas tienen que ser iguales
(o, donde se documenta, estar bajo un tope explícito). El contador es el mismo
de `tests/test_shift.py` (`before_cursor_execute` sobre el motor).

Con `-s` imprime la tabla de consultas por endpoint.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.modules.review.infrastructure.models import ReviewModel
from tests.conftest import auth_headers, count_queries, login, make_admin, register_user

pytestmark = pytest.mark.asyncio

N_CHICO = 2
N_GRANDE = 10


def _payload_turno(dia: int, puesto: str = "mozo", **extra) -> dict:
    inicio = datetime.now(timezone.utc) + timedelta(days=dia, hours=1)
    fin = inicio + timedelta(hours=6)
    base = {
        "position": puesto,
        "quantity": 1,
        "start_at": inicio.replace(tzinfo=None).isoformat(),
        "end_at": fin.replace(tzinfo=None).isoformat(),
        "pay_amount": "70000.00",
        "tips": True,
        "dress_code": "Camisa negra",
        "urgent": False,
        "city": "Palermo",
        "latitude": -34.58,
        "longitude": -58.43,
    }
    base.update(extra)
    return base


class Mundo:
    """Escenario que crece: un trabajador `W` y un comercio `E` principales, más
    comercios y trabajadores sueltos que se suman con `crecer(k)`."""

    def __init__(self, client: AsyncClient, session_factory: async_sessionmaker):
        self.client = client
        self.sf = session_factory
        self.n = 0
        self.dia = 1
        self.w_headers: dict = {}
        self.w_profile_id = ""
        self.w_user_id = ""
        self.e_headers: dict = {}
        self.e_company_id = ""
        self.e_user_id = ""
        self.shift_candidatos = ""  # turno publicado de E para /candidates
        self.shift_chat = ""  # turno asignado a W cuyo chat va sumando mensajes
        self.admin_headers: dict = {}

    async def iniciar(self) -> None:
        c = self.client
        self.w_headers = await auth_headers(c, "worker", "perf_w@staffya.com", "Trabajador Perf")
        perfil = await c.post(
            "/api/v1/workers/me/profile",
            headers=self.w_headers,
            json={"skills": ["mozo"], "latitude": -34.58, "longitude": -58.43},
        )
        assert perfil.status_code == 201, perfil.text
        self.w_profile_id = perfil.json()["id"]
        tokens = await login(c, "perf_w@staffya.com")
        self.w_user_id = tokens["user"]["id"]

        await register_user(c, email="perf_e@staffya.com", role="employer", full_name="Comercio Perf")
        tokens = await login(c, "perf_e@staffya.com")
        self.e_headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        self.e_user_id = tokens["user"]["id"]
        empresa = await c.post(
            "/api/v1/companies/me/profile",
            headers=self.e_headers,
            json={"name": "Bar Perf", "city": "Palermo", "latitude": -34.58, "longitude": -58.43},
        )
        assert empresa.status_code == 201, empresa.text
        self.e_company_id = empresa.json()["id"]

        pub = await c.post(
            "/api/v1/shifts", headers=self.e_headers, json=_payload_turno(30)
        )
        self.shift_candidatos = pub.json()["id"]
        r = await c.post(f"/api/v1/shifts/{self.shift_candidatos}/publish", headers=self.e_headers)
        assert r.status_code == 200, r.text

        self.admin_headers = await make_admin(c, self.sf, "perf_admin@staffya.com")

    async def _comercio(self, i: int) -> dict:
        email = f"perf_ce{i}@staffya.com"
        await register_user(self.client, email=email, role="employer", full_name=f"Comercio {i}")
        tokens = await login(self.client, email)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        r = await self.client.post(
            "/api/v1/companies/me/profile",
            headers=headers,
            json={"name": f"Local {i}", "city": "Palermo", "latitude": -34.58, "longitude": -58.43},
        )
        assert r.status_code == 201, r.text
        return headers

    async def _trabajador(self, i: int) -> tuple[dict, str]:
        email = f"perf_tw{i}@staffya.com"
        headers = await auth_headers(self.client, "worker", email, f"Mozo {i}")
        r = await self.client.post(
            "/api/v1/workers/me/profile",
            headers=headers,
            json={"skills": ["mozo"], "latitude": -34.58, "longitude": -58.43},
        )
        assert r.status_code == 201, r.text
        return headers, r.json()["id"]

    async def _publicar(self, headers: dict, dia: int, **extra) -> str:
        r = await self.client.post(
            "/api/v1/shifts", headers=headers, json=_payload_turno(dia, **extra)
        )
        assert r.status_code == 201, r.text
        shift_id = r.json()["id"]
        p = await self.client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
        assert p.status_code == 200, p.text
        return shift_id

    async def crecer(self, k: int) -> None:
        c = self.client
        for _ in range(k):
            i = self.n
            self.n += 1
            self.dia += 1
            # 1) Un comercio distinto publica un turno; W se postula y lo guarda.
            otro = await self._comercio(i)
            s_otro = await self._publicar(otro, self.dia)
            r = await c.post(f"/api/v1/applications/shifts/{s_otro}", headers=self.w_headers)
            assert r.status_code == 201, r.text
            r = await c.put(f"/api/v1/saved-shifts/{s_otro}", headers=self.w_headers)
            assert r.status_code in (200, 201, 204), r.text

            # 2) Un trabajador nuevo se postula al turno de E y E lo marca favorito.
            tw_headers, tw_profile = await self._trabajador(i)
            r = await c.post(
                f"/api/v1/applications/shifts/{self.shift_candidatos}", headers=tw_headers
            )
            assert r.status_code == 201, r.text
            r = await c.put(f"/api/v1/favorites/{tw_profile}", headers=self.e_headers)
            assert r.status_code in (200, 201, 204), r.text

            # 3) E publica un turno y asigna a ese trabajador (chat + avisos) ...
            s_asignado = await self._publicar(self.e_headers, self.dia + 40)
            r = await c.post(
                f"/api/v1/shifts/{s_asignado}/assign",
                headers=self.e_headers,
                json={"worker_profile_id": tw_profile},
            )
            assert r.status_code == 200, r.text
            await c.post(
                f"/api/v1/chats/{s_asignado}/messages", headers=self.e_headers, json={"body": "Hola"}
            )
            await c.post(
                f"/api/v1/chats/{s_asignado}/messages", headers=tw_headers, json={"body": "Hola!"}
            )

            # 4) ... y otro turno de E asignado a W (mis turnos, chats y avisos de W).
            s_w = await self._publicar(self.e_headers, self.dia + 80)
            r = await c.post(
                f"/api/v1/shifts/{s_w}/assign",
                headers=self.e_headers,
                json={"worker_profile_id": self.w_profile_id},
            )
            assert r.status_code == 200, r.text
            await c.post(
                f"/api/v1/chats/{s_w}/messages", headers=self.e_headers, json={"body": "Hola W"}
            )
            await c.post(
                f"/api/v1/chats/{s_w}/messages", headers=self.w_headers, json={"body": "Hola E"}
            )
            if not self.shift_chat:
                self.shift_chat = s_w
            for cuerpo in ("uno", "dos", "tres"):
                await c.post(
                    f"/api/v1/chats/{self.shift_chat}/messages",
                    headers=self.w_headers,
                    json={"body": cuerpo},
                )
            # Reseña recibida por W (insertada directo: el flujo real exige el
            # turno terminado y pagado).
            async with self.sf() as session:
                session.add(
                    ReviewModel(
                        shift_id=UUID(s_w),
                        reviewer_user_id=UUID(self.e_user_id),
                        reviewee_user_id=UUID(self.w_user_id),
                        rating=4,
                        comment="Bien",
                    )
                )
                await session.commit()


ENDPOINTS = [
    ("feed", "w", "/api/v1/shifts/feed", {}),
    ("feed scope=all", "w", "/api/v1/shifts/feed", {"scope": "all", "limit": 100}),
    ("applications/mine", "w", "/api/v1/applications/mine", {}),
    ("shifts/mine", "w", "/api/v1/shifts/mine", {}),
    ("shifts/me (comercio)", "e", "/api/v1/shifts/me", {}),
    ("shifts/{id}/candidates", "e", "/api/v1/shifts/{shift_candidatos}/candidates", {}),
    ("applications/shifts/{id}", "e", "/api/v1/applications/shifts/{shift_candidatos}", {}),
    ("matching/search", "e", "/api/v1/matching/search", {"skill": "mozo"}),
    ("notifications (W)", "w", "/api/v1/notifications", {}),
    ("chats (W)", "w", "/api/v1/chats", {}),
    ("chats (E)", "e", "/api/v1/chats", {}),
    ("favorites", "e", "/api/v1/favorites", {}),
    ("saved-shifts", "w", "/api/v1/saved-shifts", {}),
    ("reviews/received", "w", "/api/v1/reviews/received", {}),
    ("companies/{id}", "w", "/api/v1/companies/{e_company_id}", {}),
    ("workers/{id}", "e", "/api/v1/workers/{w_profile_id}", {}),
    ("admin/live-shifts", "admin", "/api/v1/admin/live-shifts", {}),
    ("admin/users", "admin", "/api/v1/admin/users", {}),
    ("admin/today", "admin", "/api/v1/admin/today", {}),
    ("admin/stats", "admin", "/api/v1/admin/stats", {}),
    ("admin/users/{id}", "admin", "/api/v1/admin/users/{w_user_id}", {}),
    ("reviews/workers/{id}", "e", "/api/v1/reviews/workers/{w_profile_id}", {}),
    ("workers/me/earnings", "w", "/api/v1/workers/me/earnings", {}),
    ("chats/{id}/messages", "w", "/api/v1/chats/{shift_chat}/messages", {}),
    ("shifts/{id}", "e", "/api/v1/shifts/{shift_candidatos}", {}),
]

# Endpoints que, por diseño, no son constantes: tope explícito (ver informe).
TOPES_EXPLICITOS: dict[str, int] = {}


async def _medir(mundo: Mundo) -> tuple[dict[str, int], dict[str, int]]:
    cabeceras = {"w": mundo.w_headers, "e": mundo.e_headers, "admin": mundo.admin_headers}
    ctx = {
        "shift_candidatos": mundo.shift_candidatos,
        "e_company_id": mundo.e_company_id,
        "w_profile_id": mundo.w_profile_id,
        "w_user_id": mundo.w_user_id,
        "shift_chat": mundo.shift_chat,
    }
    salida: dict[str, int] = {}
    tamanos: dict[str, int] = {}
    for nombre, quien, ruta, params in ENDPOINTS:
        with count_queries(mundo.sf) as contador:
            r = await mundo.client.get(
                ruta.format(**ctx), headers=cabeceras[quien], params=params
            )
        assert r.status_code == 200, f"{nombre}: {r.status_code} {r.text[:200]}"
        salida[nombre] = contador["n"]
        cuerpo = r.json()
        tamanos[nombre] = len(cuerpo) if isinstance(cuerpo, list) else -1
    return salida, tamanos


async def test_consultas_no_crecen_con_la_cantidad_de_filas(
    client: AsyncClient, session_factory: async_sessionmaker
):
    mundo = Mundo(client, session_factory)
    await mundo.iniciar()

    await mundo.crecer(N_CHICO)
    chico, filas_chico = await _medir(mundo)
    await mundo.crecer(N_GRANDE - N_CHICO)
    grande, filas_grande = await _medir(mundo)

    print("\n\nendpoint                      N=2  N=10   filas(2->10)")
    for nombre, *_ in ENDPOINTS:
        print(
            f"{nombre:<28} {chico[nombre]:>4} {grande[nombre]:>5}   "
            f"{filas_chico[nombre]}->{filas_grande[nombre]}"
        )

    crecen = []
    for nombre, *_ in ENDPOINTS:
        tope = TOPES_EXPLICITOS.get(nombre, chico[nombre])
        if grande[nombre] > tope:
            crecen.append(f"{nombre}: {chico[nombre]} -> {grande[nombre]} (tope {tope})")
    assert not crecen, "Consultas que crecen con N (N+1):\n" + "\n".join(crecen)
