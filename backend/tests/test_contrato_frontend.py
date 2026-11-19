"""Contrato backend <-> frontend: respuestas reales que usan los e2e.

Los e2e del frontend simulan la API con `page.route(...)`. Un mock escrito a
mano puede mentir (inventar un campo, olvidar uno, mandar un status que el
servidor nunca manda). Este test recorre escenarios reales contra la app, captura
status y cuerpo de cada respuesta y los guarda en
`frontend/e2e/contrato/respuestas.json`, de donde los specs arman sus mocks
(`frontend/e2e/contrato.ts`).

- Sin variable: compara la FORMA (claves recursivas, tipo JSON de cada valor y
  status) contra el archivo y falla diciendo qué cambió.
- `ACTUALIZAR_CONTRATO=1`: reescribe el archivo.

Lo volátil se normaliza antes de comparar o escribir: UUIDs a ids legibles
(`shift-1`, `user-worker-1`), tokens a `token-de-prueba`, fechas de creación a
una fija. gitleaks escanea el repo entero y toma UUIDs y tokens como claves:
no puede quedar ninguno en el JSON.
"""

import json
import os
import re
from datetime import timedelta
from pathlib import Path

import pytest
from httpx import AsyncClient

from app.core.tz import now_art
from tests.conftest import current_totp, login, promote_to_admin, register_user

pytestmark = pytest.mark.asyncio

RUTA = Path(__file__).resolve().parents[2] / "frontend" / "e2e" / "contrato" / "respuestas.json"
REGENERAR = "ACTUALIZAR_CONTRATO=1 python -m pytest -q tests/test_contrato_frontend.py"

_UUID = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)
_JWT = re.compile(r"eyJ[\w-]+\.[\w-]+\.[\w-]+")
_DIA = re.compile(r"(\d{2}:\d{2} del )(?:lunes|martes|miércoles|jueves|viernes|sábado|domingo)")
_FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")
# Campos de fecha que dependen del reloj del momento de correr el test.
_FECHA_FIJA = "2026-11-01T12:00:00+00:00"
# Campos que dependen del reloj o del azar de cada corrida.
_VOLATIL_OTROS = {"slug", "share_token"}
# Horario fijo del turno en el archivo (el real se calcula desde hoy, porque el
# feed y la página pública sólo muestran turnos que todavía no empezaron).
_HORARIO_FIJO = {"start_at": "2026-12-20T20:00:00", "end_at": "2026-12-21T03:00:00"}


class Normalizador:
    """UUID -> id legible y estable dentro del archivo."""

    def __init__(self) -> None:
        self.alias: dict[str, str] = {}
        self.contadores: dict[str, int] = {}

    def nombrar(self, uuid: str, prefijo: str) -> str:
        """Fija el nombre de un UUID conocido (`shift-1`, `user-worker-1`)."""
        n = self.contadores.get(prefijo, 0) + 1
        self.contadores[prefijo] = n
        nombre = f"{prefijo}-{n}"
        self.alias[uuid.lower()] = nombre
        return nombre

    def _uuid(self, m: re.Match) -> str:
        clave = m.group(0).lower()
        if clave not in self.alias:
            self.nombrar(clave, "id")
        return self.alias[clave]

    def texto(self, s: str) -> str:
        s = _DIA.sub(r"\1domingo", s)  # «desde las 16:30 del <día de hoy + 3>»
        return _JWT.sub("token-de-prueba", _UUID.sub(self._uuid, s))

    def _por_forma(self, d: dict) -> None:
        """Nombra ids de aviso y de postulación antes de que caigan en `id-N`."""
        for clave, prefijo, marca in (
            ("id", "notification", {"read", "title", "type"}),
            ("id", "application", {"shift_id", "worker_profile_id", "status"}),
            ("application_id", "application", {"application_id"}),
        ):
            if marca <= d.keys() and isinstance(d.get(clave), str) and _UUID.fullmatch(d[clave]):
                if d[clave].lower() not in self.alias:
                    self.nombrar(d[clave], prefijo)

    def valor(self, v, clave: str = ""):
        if isinstance(v, dict):
            self._por_forma(v)
            return {k: self.valor(x, k) for k, x in v.items()}
        if isinstance(v, list):
            return [self.valor(x, clave) for x in v]
        if isinstance(v, str):
            if clave in ("access_token", "token", "refresh_token"):
                return "token-de-prueba"
            if clave in _VOLATIL_OTROS:
                return "valor-de-prueba"
            if clave in _HORARIO_FIJO and _FECHA.match(v):
                return _HORARIO_FIJO[clave]
            if clave.endswith("_at") and _FECHA.match(v):
                return _FECHA_FIJA
            if clave in ("period_end", "paid_until") and _FECHA.match(v):
                return _FECHA_FIJA
            return self.texto(v)
        return v


def forma(v):
    """Forma de un valor JSON: claves recursivas y tipo de cada hoja."""
    if isinstance(v, dict):
        return {k: forma(x) for k, x in sorted(v.items())}
    if isinstance(v, list):
        formas = []
        for x in v:
            f = forma(x)
            if f not in formas:
                formas.append(f)
        return formas
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    return "string"


def _diferencias(esperada, actual, ruta="") -> list[str]:
    if isinstance(esperada, dict) and isinstance(actual, dict):
        out = []
        for k in sorted(set(esperada) | set(actual)):
            donde = f"{ruta}.{k}" if ruta else k
            if k not in actual:
                out.append(f"falta {donde} (el archivo la tiene, el backend ya no la manda)")
            elif k not in esperada:
                out.append(f"sobra {donde} (el backend la manda, el archivo no la tiene)")
            else:
                out += _diferencias(esperada[k], actual[k], donde)
        return out
    if isinstance(esperada, list) and isinstance(actual, list):
        if esperada != actual:
            return [f"{ruta or '(raíz)'}: la forma de los elementos cambió: {esperada} -> {actual}"]
        return []
    if esperada != actual:
        return [f"{ruta or '(raíz)'}: tipo {esperada} -> {actual}"]
    return []


class Captura:
    def __init__(self) -> None:
        self.norm = Normalizador()
        self.respuestas: dict = {}

    def guardar(self, nombre: str, resp) -> dict:
        assert nombre not in self.respuestas, nombre
        try:
            cuerpo = resp.json()
        except ValueError:
            cuerpo = None
        self.respuestas[nombre] = {
            "status": resp.status_code,
            "body": self.norm.valor(cuerpo),
        }
        return cuerpo


def _horario(dias: int, horas: int = 7) -> dict:
    """Turno de `horas` que empieza a las 20 de dentro de `dias` días."""
    inicio = (now_art() + timedelta(days=dias)).replace(
        hour=20, minute=0, second=0, microsecond=0, tzinfo=None
    )
    return {
        "start_at": inicio.isoformat(),
        "end_at": (inicio + timedelta(hours=horas)).isoformat(),
    }


def _payload(**o) -> dict:
    p = {
        "position": "mozo",
        "quantity": 1,
        **_horario(3),
        "pay_amount": "70000.00",
        "tips": True,
        "city": "Palermo",
        "address": "Thames 1234",
    }
    p.update(o)
    return p


async def _registrar(client, cap, email, role, nombre, alias):
    reg = await register_user(client, email=email, full_name=nombre, role=role)
    assert reg.status_code == 201, reg.text
    tokens = await login(client, email)
    cap.norm.nombrar(tokens["user"]["id"], alias)
    return tokens, {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_contrato_frontend(client: AsyncClient, session_factory):
    cap = Captura()

    # --- Comercio, trabajador y sesión -----------------------------------
    tok_emp, emp = await _registrar(
        client, cap, "contrato_emp@staffya.com", "employer", "Comercio Prueba", "user-employer"
    )
    cap.guardar("login", await client.post(
        "/api/v1/auth/login",
        json={"email": "contrato_emp@staffya.com", "password": "supersecreta123"},
    ))
    cap.guardar("auth_me_employer", await client.get("/api/v1/auth/me", headers=emp))

    tok_w, wk = await _registrar(
        client, cap, "contrato_w1@staffya.com", "worker", "Trabajador Uno", "user-worker"
    )
    cap.guardar("auth_me_worker", await client.get("/api/v1/auth/me", headers=wk))
    _, wk2 = await _registrar(
        client, cap, "contrato_w2@staffya.com", "worker", "Trabajador Dos", "user-worker"
    )
    _, otro_emp = await _registrar(
        client, cap, "contrato_emp2@staffya.com", "employer", "Otro Comercio", "user-employer"
    )

    perfil_emp = await client.post(
        "/api/v1/companies/me/profile", headers=emp,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    cap.norm.nombrar(perfil_emp.json()["id"], "company")
    await client.post(
        "/api/v1/companies/me/profile", headers=otro_emp,
        json={"name": "Otro Bar", "city": "Palermo"},
    )
    perfil_w = await client.post(
        "/api/v1/workers/me/profile", headers=wk, json={"skills": ["mozo"]}
    )
    cap.norm.nombrar(perfil_w.json()["id"], "worker-profile")
    perfil_w2 = await client.post(
        "/api/v1/workers/me/profile", headers=wk2, json={"skills": ["mozo"]}
    )
    cap.norm.nombrar(perfil_w2.json()["id"], "worker-profile")

    # --- Turno: borrador, publicado, postulaciones, asignado, confirmado ---
    creado = await client.post("/api/v1/shifts", headers=emp, json=_payload())
    sid = cap.norm.nombrar(creado.json()["id"], "shift")
    shift_id = creado.json()["id"]
    cap.guardar("turno_crear", creado)
    cap.guardar("turno_borrador_comercio", await client.get(f"/api/v1/shifts/{shift_id}", headers=emp))
    cap.guardar("turno_borrador_ajeno", await client.get(f"/api/v1/shifts/{shift_id}", headers=wk))
    cap.guardar("turno_borrador_otro_comercio", await client.get(f"/api/v1/shifts/{shift_id}", headers=otro_emp))
    assert sid == "shift-1"

    cap.guardar("turno_publicar", await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=emp))
    cap.guardar("turno_publicado_comercio", await client.get(f"/api/v1/shifts/{shift_id}", headers=emp))
    cap.guardar("turno_publicado_trabajador", await client.get(f"/api/v1/shifts/{shift_id}", headers=wk))
    cap.guardar("turno_publico", await client.get(f"/api/v1/shifts/{shift_id}/public"))
    cap.guardar("feed", await client.get("/api/v1/shifts/feed?scope=all", headers=wk))
    cap.guardar("turnos_del_comercio", await client.get("/api/v1/shifts/me", headers=emp))

    post1 = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=wk)
    cap.norm.nombrar(post1.json()["id"], "application")
    cap.guardar("postular", post1)
    cap.guardar("postular_repetida", await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=wk))
    post2 = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=wk2)
    cap.norm.nombrar(post2.json()["id"], "application")
    cap.guardar("postular_turno_inexistente", await client.post(
        "/api/v1/applications/shifts/00000000-0000-4000-8000-000000000000", headers=wk))
    cap.guardar("postulaciones_mias", await client.get("/api/v1/applications/mine", headers=wk))
    # Mismo created_at: el orden de los postulantes no es estable entre corridas.
    lista = await client.get(f"/api/v1/applications/shifts/{shift_id}", headers=emp)
    cap.guardar("postulantes", lista)
    cap.respuestas["postulantes"]["body"].sort(key=lambda p: p["full_name"])
    cap.guardar("postulantes_de_turno_ajeno", await client.get(
        f"/api/v1/applications/shifts/{shift_id}", headers=otro_emp))
    cap.guardar("avisos_comercio", await client.get("/api/v1/notifications", headers=emp))

    cap.guardar("turno_asignar", await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=emp,
        json={"worker_profile_id": perfil_w.json()["id"]}))
    cap.guardar("turno_asignado_comercio", await client.get(f"/api/v1/shifts/{shift_id}", headers=emp))
    cap.guardar("turnos_asignados_trabajador", await client.get("/api/v1/shifts/mine", headers=wk))
    cap.guardar("turno_asignar_ya_asignado", await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=emp,
        json={"worker_profile_id": perfil_w2.json()["id"]}))
    cap.guardar("avisos_trabajador", await client.get("/api/v1/notifications", headers=wk))

    cap.guardar("turno_confirmar", await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=wk))
    cap.guardar("turno_llegada_antes_de_tiempo", await client.post(
        f"/api/v1/shifts/{shift_id}/check-in", headers=wk,
        json={"latitude": -34.60, "longitude": -58.40}))
    cap.guardar("turno_confirmar_repetido", await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=wk))
    cap.guardar("turno_confirmado_trabajador", await client.get(f"/api/v1/shifts/{shift_id}", headers=wk))
    cap.guardar("turnos_del_comercio_con_asignado", await client.get("/api/v1/shifts/me", headers=emp))

    # --- Turno en camino (el comercio ve la posición) -----------------------
    ahora = now_art().replace(tzinfo=None, microsecond=0)
    e = await client.post("/api/v1/shifts", headers=emp, json=_payload(
        start_at=(ahora + timedelta(hours=1)).isoformat(),
        end_at=(ahora + timedelta(hours=8)).isoformat()))
    cap.norm.nombrar(e.json()["id"], "shift")
    eid = e.json()["id"]
    await client.post(f"/api/v1/shifts/{eid}/publish", headers=emp)
    await client.post(f"/api/v1/shifts/{eid}/assign", headers=emp,
                      json={"worker_profile_id": perfil_w.json()["id"]})
    await client.post(f"/api/v1/shifts/{eid}/confirm", headers=wk)
    cap.guardar("turno_en_camino", await client.post(
        f"/api/v1/shifts/{eid}/en-route", headers=wk,
        json={"latitude": -34.60, "longitude": -58.40}))
    cap.guardar("turno_en_camino_comercio", await client.get(f"/api/v1/shifts/{eid}", headers=emp))
    cap.guardar("turno_en_camino_ajeno", await client.get(f"/api/v1/shifts/{eid}", headers=wk2))

    # --- Turno cancelado por el comercio con alguien asignado ---------------
    c = await client.post("/api/v1/shifts", headers=emp, json=_payload(**_horario(6)))
    cap.norm.nombrar(c.json()["id"], "shift")
    cid = c.json()["id"]
    await client.post(f"/api/v1/shifts/{cid}/publish", headers=emp)
    await client.post(f"/api/v1/shifts/{cid}/assign", headers=emp,
                      json={"worker_profile_id": perfil_w2.json()["id"]})
    cap.guardar("turno_cancelar", await client.post(f"/api/v1/shifts/{cid}/cancel", headers=emp))
    cap.guardar("turno_cancelar_repetido", await client.post(f"/api/v1/shifts/{cid}/cancel", headers=emp))
    cap.guardar("turno_cancelado_confirmar", await client.post(f"/api/v1/shifts/{cid}/confirm", headers=wk2))
    cap.guardar("turno_cancelado_asignar", await client.post(
        f"/api/v1/shifts/{cid}/assign", headers=emp,
        json={"worker_profile_id": perfil_w2.json()["id"]}))
    cap.guardar("turno_cancelado_publico", await client.get(f"/api/v1/shifts/{cid}/public"))
    cap.guardar("turno_cancelado_ajeno", await client.get(f"/api/v1/shifts/{cid}", headers=wk))

    # --- Errores ----------------------------------------------------------
    inexistente = "00000000-0000-4000-8000-000000000000"
    cap.guardar("error_404_turno", await client.get(f"/api/v1/shifts/{inexistente}", headers=emp))
    cap.guardar("error_404_cancelar_ajeno", await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=otro_emp))
    cap.guardar("error_401_sin_sesion", await client.get("/api/v1/auth/me"))
    cap.guardar("error_401_token_invalido", await client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer token-de-prueba"}))
    cap.guardar("error_403_rol", await client.post(f"/api/v1/shifts", headers=wk, json=_payload()))
    cap.guardar("error_422_cantidad", await client.post(
        "/api/v1/shifts", headers=emp, json=_payload(quantity=0)))
    cap.guardar("error_422_faltan_campos", await client.post("/api/v1/shifts", headers=emp, json={}))
    cap.guardar("error_422_id_mal_formado", await client.get("/api/v1/shifts/no-es-un-id", headers=emp))
    cap.guardar("error_400_horario", await client.post(
        "/api/v1/shifts", headers=emp,
        json=_payload(start_at=_horario(3)["end_at"], end_at=_horario(3)["start_at"])))
    cap.guardar("login_mal", await client.post(
        "/api/v1/auth/login", json={"email": "contrato_emp@staffya.com", "password": "otra-clave-mal"}))

    # --- Chat y registro (422 de Pydantic con ctx) ---------------------------
    cap.guardar("chat_mensaje_largo", await client.post(
        f"/api/v1/chats/{shift_id}/messages", headers=wk, json={"body": "x" * 2001}))
    cap.guardar("registro_mail_invalido", await register_user(
        client, email="lucia@bar", full_name="Lucia Gomez", role="worker"))
    cap.guardar("registro_mail_repetido", await register_user(
        client, email="contrato_w1@staffya.com", full_name="Trabajador Uno", role="worker"))

    # --- Suscripción ------------------------------------------------------
    cap.guardar("suscripcion_comercio", await client.get("/api/v1/subscription", headers=emp))

    # --- Admin sin el segundo paso (403 con `code`) -----------------------
    await register_user(client, email="contrato_adm@staffya.com", role="employer",
                        full_name="Admin Prueba")
    await promote_to_admin(session_factory, "contrato_adm@staffya.com")
    tok_adm = await login(client, "contrato_adm@staffya.com")
    pendiente = {"Authorization": f"Bearer {tok_adm['access_token']}"}
    cap.norm.nombrar(tok_adm["user"]["id"], "user-admin")
    cap.guardar("auth_me_admin_sin_dos_pasos", await client.get("/api/v1/auth/me", headers=pendiente))
    cap.guardar("error_403_dos_pasos", await client.get("/api/v1/notifications", headers=pendiente))
    setup = await client.post("/api/v1/auth/2fa/setup", json={}, headers=pendiente)
    conf = await client.post(
        "/api/v1/auth/2fa/confirm",
        json={"code": current_totp(setup.json()["secret"])}, headers=pendiente)
    verificado = {"Authorization": f"Bearer {conf.json()['access_token']}"}
    cap.guardar("auth_me_admin", await client.get("/api/v1/auth/me", headers=verificado))

    # --- Compara o escribe ------------------------------------------------
    nuevo = cap.respuestas
    assert nuevo, "sin respuestas capturadas"
    assert not _JWT.search(json.dumps(nuevo)), "quedó un token en el contrato"
    assert not _UUID.search(json.dumps(nuevo)), "quedó un UUID en el contrato"
    texto = json.dumps(nuevo, ensure_ascii=False, indent=2, sort_keys=True) + "\n"

    if os.environ.get("ACTUALIZAR_CONTRATO") == "1":
        RUTA.parent.mkdir(parents=True, exist_ok=True)
        RUTA.write_text(texto, encoding="utf-8")
        return

    assert RUTA.exists(), f"Falta {RUTA}. Generalo con: {REGENERAR}"
    guardado = json.loads(RUTA.read_text(encoding="utf-8"))
    problemas: list[str] = []
    for nombre in sorted(set(guardado) | set(nuevo)):
        if nombre not in nuevo:
            problemas.append(f"[{nombre}] el escenario ya no se captura")
        elif nombre not in guardado:
            problemas.append(f"[{nombre}] escenario nuevo, no está en el archivo")
        else:
            if guardado[nombre]["status"] != nuevo[nombre]["status"]:
                problemas.append(
                    f"[{nombre}] status {guardado[nombre]['status']} -> {nuevo[nombre]['status']}"
                )
            for d in _diferencias(forma(guardado[nombre]["body"]), forma(nuevo[nombre]["body"])):
                problemas.append(f"[{nombre}] {d}")
    assert not problemas, (
        "El backend ya no responde como dice frontend/e2e/contrato/respuestas.json:\n  "
        + "\n  ".join(problemas)
        + f"\nSi el cambio es intencional, actualizá los tipos y mocks del frontend y regenerá con:\n  {REGENERAR}"
    )
