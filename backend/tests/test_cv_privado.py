"""El CV del trabajador es privado (PRI-03, pasada de privacidad 2026-11-19;
ADR-0021, «Actualización 2026-11-19: el CV también»).

El CV trae teléfono, email y domicilio. Subía a Cloudinary como archivo
público y sin vencimiento: quien vio el link una vez lo seguía abriendo para
siempre, aunque el vínculo terminara o la persona cambiara o sacara el CV (el
archivo viejo no se borraba). Ahora sube `authenticated` (ni el original ni
una versión transformada se ven sin firma), se ve con un link que vence y
sólo a quien hoy lo puede ver, y el archivo que se deja de usar se borra.
"""

import hashlib
import time
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse
from uuid import UUID, uuid4

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy import update as sa_update

from app.core.cloudinary import cv_public_id_for, is_cv_upload_of, sign_cv_upload
from app.core.config import settings
from app.modules.verification.infrastructure.file_cleanup_job import (
    run_evidence_file_cleanup,
)
from app.modules.verification.infrastructure.models import EvidenceFileDeletionModel
from app.modules.worker.infrastructure.models import WorkerProfileModel
from scripts import privatize_worker_cvs as script
from tests.conftest import make_admin
from tests.test_attendance import _employer_with_company, _worker_with_profile
from tests.test_evidencias_privadas import AHORA, FakeAdmin, _asset
from tests.test_privacidad_datos_trabajador import _published_shift_near_start

pytestmark = pytest.mark.asyncio


@pytest.fixture
def cloudinary_on():
    keys = ("cloudinary_api_key", "cloudinary_api_secret", "cloudinary_cloud_name")
    original = {k: getattr(settings, k) for k in keys}
    settings.cloudinary_api_key = "test-api-key"
    settings.cloudinary_api_secret = "test-api-secret"
    settings.cloudinary_cloud_name = "oido-test"
    yield
    for k, v in original.items():
        setattr(settings, k, v)


def _sha1(params: dict[str, str]) -> str:
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params))
    return hashlib.sha1(f"{to_sign}test-api-secret".encode()).hexdigest()


def _cv(user_id: str, *, raw: bool = False) -> dict:
    """Lo que devuelve Cloudinary al subir el CV con la firma de esa cuenta."""
    public_id = f"oido/cv/{cv_public_id_for(UUID(user_id))}"
    if raw:  # un Word: Cloudinary le pega la extensión al nombre
        return {
            "public_id": f"{public_id}.docx",
            "resource_type": "raw",
            "format": "",
            "type": "authenticated",
        }
    return {
        "public_id": public_id,
        "resource_type": "image",
        "format": "pdf",
        "type": "authenticated",
    }


async def _me(client: AsyncClient, headers: dict) -> dict:
    return (await client.get("/api/v1/workers/me/profile", headers=headers)).json()


async def _put_cv(client: AsyncClient, headers: dict, **cv) -> httpx.Response:
    return await client.put(
        "/api/v1/workers/me/profile", headers=headers, json={"skills": ["mozo"], **cv}
    )


async def _worker_with_cv(client: AsyncClient, email: str) -> tuple[dict, str, dict]:
    worker, profile_id = await _worker_with_profile(client, email)
    cv = _cv((await _me(client, worker))["user_id"])
    saved = await _put_cv(client, worker, cv_file=cv, cv_filename="Perez_CV.pdf")
    assert saved.status_code == 200, saved.text
    return worker, profile_id, cv


async def _link(client: AsyncClient, profile_id: str, headers: dict, **params) -> httpx.Response:
    return await client.get(
        f"/api/v1/workers/{profile_id}/cv-link", headers=headers, params=params
    )


async def _queue(session_factory) -> list[EvidenceFileDeletionModel]:
    """Los pedidos de borrado pendientes (los confirmados quedan marcados)."""
    async with session_factory() as session:
        stmt = select(EvidenceFileDeletionModel).where(
            EvidenceFileDeletionModel.deleted_at.is_(None)
        )
        return list((await session.execute(stmt)).scalars())


# --- La subida ----------------------------------------------------------------


def test_el_cv_sube_protegido_como_los_documentos(cloudinary_on):
    """El repro de PRI-03: la firma del CV no traía `type`, y Cloudinary lo
    guardaba público (`upload`). Y no `private`: deja ver sin firma las
    versiones transformadas (revisión del 2026-11-19)."""
    assert sign_cv_upload(uuid4())["type"] == "authenticated"


def test_el_nombre_del_cv_lleva_la_marca_de_quien_lo_sube(cloudinary_on):
    """El link que vence muestra el nombre del archivo. Sin la marca, un
    comercio que vio el CV podía hacerse una cuenta de trabajador, ponerse
    ese archivo y pedir links para siempre."""
    owner, other = uuid4(), uuid4()
    public_id = sign_cv_upload(owner)["public_id"]
    assert is_cv_upload_of(public_id, owner)
    assert is_cv_upload_of(f"oido/cv/{public_id}", owner)
    assert is_cv_upload_of(f"oido/cv/{public_id}.docx", owner)
    assert not is_cv_upload_of(public_id, other)
    assert not is_cv_upload_of(f"oido/perfiles/{public_id}", owner)
    assert not is_cv_upload_of(uuid4().hex, owner)  # uno de antes, sin marca
    tampered = public_id[:-1] + ("0" if public_id[-1] != "0" else "1")
    assert not is_cv_upload_of(tampered, owner)


# --- El link que vence ----------------------------------------------------------


async def test_el_perfil_ya_no_trae_una_url_y_el_link_vence(client, cloudinary_on):
    worker, profile_id, cv = await _worker_with_cv(client, "cvp_dueno@test.com")

    mine = await _me(client, worker)
    assert mine["cv_file"] == cv
    assert (mine["cv_url"], mine["cv_kind"], mine["cv_filename"]) == (None, "file", "Perez_CV.pdf")

    antes = int(time.time())
    resp = await _link(client, profile_id, worker)
    assert resp.status_code == 200
    body = resp.json()
    url = urlparse(body["url"])
    assert (url.scheme, url.netloc, url.path) == (
        "https",
        "api.cloudinary.com",
        "/v1_1/oido-test/image/download",
    )
    params = {k: v[0] for k, v in parse_qs(url.query).items()}
    assert params["public_id"] == cv["public_id"]
    assert params["type"] == "authenticated"
    assert "attachment" not in params
    assert antes + 290 <= int(params["expires_at"]) <= int(time.time()) + 310
    assert body["expires_at"] is not None
    firmados = {k: v for k, v in params.items() if k not in ("signature", "api_key")}
    assert params["signature"] == _sha1(firmados)


async def test_descargar_pide_el_archivo_como_adjunto(client, cloudinary_on):
    worker, profile_id, _ = await _worker_with_cv(client, "cvp_baja@test.com")
    resp = await _link(client, profile_id, worker, download="true")
    params = parse_qs(urlparse(resp.json()["url"]).query)
    assert params["attachment"] == ["true"]


async def test_el_link_solo_a_quien_hoy_puede_ver_el_cv(client, session_factory, cloudinary_on):
    worker, profile_id, cv = await _worker_with_cv(client, "cvp_regla@test.com")
    linked = await _employer_with_company(client, "cvp_regla_emp1@test.com")
    stranger = await _employer_with_company(client, "cvp_regla_emp2@test.com")
    other_worker, _ = await _worker_with_profile(client, "cvp_regla_otro@test.com")
    admin = await make_admin(client, session_factory, "cvp_regla_admin@test.com")

    for headers in (linked, stranger, other_worker):
        assert (await _link(client, profile_id, headers)).status_code == 404

    shift_id = await _published_shift_near_start(client, linked)
    applied = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    assert applied.status_code in (200, 201)

    for headers in (linked, admin):
        assert (await _link(client, profile_id, headers)).status_code == 200
    for headers in (stranger, other_worker):
        assert (await _link(client, profile_id, headers)).status_code == 404

    # El perfil que ve el comercio dice qué CV hay, pero no trae nada que lo
    # abra: ni URL ni el nombre del archivo en Cloudinary.
    seen = await client.get(f"/api/v1/workers/{profile_id}", headers=linked)
    body = seen.json()
    assert (body["cv_kind"], body["cv_filename"]) == ("file", "Perez_CV.pdf")
    assert (body["cv_file"], body["cv_url"]) == (None, None)
    assert cv["public_id"] not in seen.text
    assert "cloudinary" not in seen.text
    admin_view = (await client.get(f"/api/v1/workers/{profile_id}", headers=admin)).json()
    assert (admin_view["cv_file"], admin_view["cv_kind"]) == (None, "file")
    stranger_view = (await client.get(f"/api/v1/workers/{profile_id}", headers=stranger)).json()
    assert (stranger_view["cv_kind"], stranger_view["cv_filename"]) == (None, None)


async def test_sin_cv_o_perfil_inexistente_da_404(client, cloudinary_on):
    worker, profile_id = await _worker_with_profile(client, "cvp_sin@test.com")
    assert (await _link(client, profile_id, worker)).status_code == 404
    assert (await _link(client, str(uuid4()), worker)).status_code == 404


async def test_sin_configuracion_el_link_responde_503(client, cloudinary_on):
    worker, profile_id, _ = await _worker_with_cv(client, "cvp_503@test.com")
    settings.cloudinary_cloud_name = ""
    assert (await _link(client, profile_id, worker)).status_code == 503


# --- Qué entra como CV ----------------------------------------------------------


async def test_un_archivo_que_no_subio_esa_cuenta_no_entra(client, cloudinary_on):
    victim, _, cv = await _worker_with_cv(client, "cvp_victima@test.com")
    thief, _ = await _worker_with_profile(client, "cvp_ladron@test.com")

    for intento in (
        {"cv_file": cv},  # el nombre que vio en el link de otro
        {"cv_file": {**cv, "public_id": f"oido/cv/{uuid4().hex}"}},  # sin marca
        # Un link público de Cloudinary ya no entra como «link pegado».
        {"cv_url": "https://res.cloudinary.com/oido-test/raw/upload/v1/oido/cv/abc.pdf"},
    ):
        resp = await _put_cv(client, thief, **intento)
        assert resp.status_code == 422, intento
        assert "Subilo de nuevo" in resp.json()["detail"]
    assert (await _me(client, thief))["cv_kind"] is None
    assert (await _me(client, victim))["cv_file"] == cv
    # Un archivo `private` propio tampoco: deja ver sin firma sus versiones
    # transformadas (revisión del 2026-11-19).
    propio = _cv((await _me(client, thief))["user_id"])
    resp = await _put_cv(client, thief, cv_file={**propio, "type": "private"})
    assert resp.status_code == 422


async def test_un_link_pegado_a_mano_sigue_andando(client, cloudinary_on):
    worker, profile_id = await _worker_with_profile(client, "cvp_link@test.com")
    drive = "https://drive.example/mi-cv"
    assert (await _put_cv(client, worker, cv_url=drive)).status_code == 200
    resp = await _link(client, profile_id, worker)
    assert resp.json() == {"url": drive, "expires_at": None}
    assert (await _me(client, worker))["cv_kind"] == "link"


async def test_el_nombre_del_archivo_va_y_vuelve_y_se_va_con_el_cv(client, cloudinary_on):
    """F1 (auditoría de producto 2026-08-10): el nombre real del archivo se
    guarda aparte (el `public_id` es un hash). Al sacar el CV no queda un
    nombre huérfano."""
    worker, _, cv = await _worker_with_cv(client, "cvp_nombre@test.com")
    assert (await _me(client, worker))["cv_filename"] == "Perez_CV.pdf"

    removed = await _put_cv(client, worker, cv_file=None, cv_url=None, cv_filename=None)
    assert removed.status_code == 200
    body = removed.json()
    assert (body["cv_file"], body["cv_url"], body["cv_filename"], body["cv_kind"]) == (
        None,
        None,
        None,
        None,
    )


# --- El archivo viejo se borra ------------------------------------------------


async def test_cambiar_o_sacar_el_cv_borra_el_archivo_viejo(
    client, session_factory, evidence_storage, cloudinary_on
):
    worker, _, first = await _worker_with_cv(client, "cvp_cambia@test.com")
    second = _cv((await _me(client, worker))["user_id"], raw=True)

    assert (await _put_cv(client, worker, cv_file=second, cv_filename="CV.docx")).status_code == 200
    assert [(f.public_id, f.delivery_type) for f in evidence_storage.deleted] == [
        (first["public_id"], "authenticated")
    ]
    assert (await _me(client, worker))["cv_file"] == second

    # Sacarlo (o reemplazarlo por un link pegado) también borra el archivo.
    assert (await _put_cv(client, worker, cv_url="https://drive.example/cv")).status_code == 200
    assert [f.public_id for f in evidence_storage.deleted] == [
        first["public_id"],
        second["public_id"],
    ]
    assert evidence_storage.deleted[1].resource_type == "raw"
    assert await _queue(session_factory) == []


async def test_guardar_otra_parte_del_perfil_no_toca_el_cv(
    client, evidence_storage, cloudinary_on
):
    """La app guarda el perfil entero (reemplaza, no parchea): manda de vuelta
    la referencia que recibió. Y una versión vieja (PWA en caché) que no
    conoce `cv_file` manda `cv_url` vacío: el archivo se conserva."""
    worker, _, cv = await _worker_with_cv(client, "cvp_ida@test.com")

    roundtrip = await _put_cv(client, worker, cv_file=cv, cv_filename="Perez_CV.pdf", bio="Hola")
    assert roundtrip.status_code == 200
    old_app = await _put_cv(client, worker, cv_url=None, cv_filename=None, bio="Chau")
    assert old_app.status_code == 200
    mine = await _me(client, worker)
    assert (mine["cv_file"], mine["cv_filename"], mine["bio"]) == (cv, "Perez_CV.pdf", "Chau")
    assert evidence_storage.deleted == []


async def test_un_formulario_abierto_desde_antes_no_vuelve_a_poner_un_cv_cambiado(
    client, evidence_storage, cloudinary_on
):
    """Revisión del 2026-11-19: con el formulario abierto en A, la persona
    cambia a B en otro lado (A se borra). Si el formulario viejo manda A, el
    perfil quedaba apuntando a un archivo borrado y B se mandaba a borrar."""
    worker, _, a = await _worker_with_cv(client, "cvp_viejo_form@test.com")
    user_id = (await _me(client, worker))["user_id"]
    b = _cv(user_id)
    assert (await _put_cv(client, worker, cv_file=b)).status_code == 200

    resp = await _put_cv(client, worker, cv_file=a, bio="desde el formulario viejo")
    assert resp.status_code == 409
    assert "Volvé a abrir tu perfil" in resp.json()["detail"]
    assert (await _me(client, worker))["cv_file"] == b
    assert [f.public_id for f in evidence_storage.deleted] == [a["public_id"]]

    # Tampoco mientras el borrado está pendiente (Cloudinary caído).
    evidence_storage.fail = True
    assert (await _put_cv(client, worker, cv_file=_cv(user_id))).status_code == 200
    assert (await _put_cv(client, worker, cv_file=b)).status_code == 409


async def test_el_mismo_archivo_con_otro_formato_no_lo_manda_a_borrar(
    client, evidence_storage, cloudinary_on
):
    """Revisión del 2026-11-19: el mismo `public_id` con otro `format` se
    tomaba como otro archivo y mandaba a borrar el que estaba en uso."""
    worker, _, cv = await _worker_with_cv(client, "cvp_formato@test.com")
    resp = await _put_cv(client, worker, cv_file={**cv, "format": "jpg"})
    assert resp.status_code == 200
    assert evidence_storage.deleted == []
    assert (await _me(client, worker))["cv_file"] == cv  # queda el guardado


async def test_una_version_vieja_de_la_app_que_sube_el_cv_lo_guarda_privado(
    client, evidence_storage, cloudinary_on
):
    """La versión vieja manda la firma tal cual (con `type=authenticated`) y
    guarda la URL (firmada) que le devuelve Cloudinary: se toma como el
    archivo, sin guardar esa URL."""
    worker, _ = await _worker_with_profile(client, "cvp_pwa@test.com")
    cv = _cv((await _me(client, worker))["user_id"], raw=True)
    url = f"https://res.cloudinary.com/oido-test/raw/authenticated/s--abcd1234--/v17/{cv['public_id']}"
    assert (await _put_cv(client, worker, cv_url=url, cv_filename="CV.docx")).status_code == 200
    mine = await _me(client, worker)
    assert (mine["cv_file"], mine["cv_url"], mine["cv_filename"]) == (cv, None, "CV.docx")


async def test_si_cloudinary_falla_el_borrado_queda_en_la_cola_y_se_reintenta(
    client, session_factory, evidence_storage, cloudinary_on
):
    worker, _, first = await _worker_with_cv(client, "cvp_falla@test.com")
    evidence_storage.fail = True
    second = _cv((await _me(client, worker))["user_id"])
    assert (await _put_cv(client, worker, cv_file=second)).status_code == 200

    [pending] = await _queue(session_factory)
    assert (pending.public_id, pending.attempts) == (first["public_id"], 1)

    evidence_storage.fail = False
    later = datetime.now(UTC) + timedelta(minutes=16)
    assert await run_evidence_file_cleanup(session_factory, evidence_storage, now=later) is None
    assert [f.public_id for f in evidence_storage.deleted] == [first["public_id"]]
    assert await _queue(session_factory) == []


async def _set_legacy_cv(session_factory, profile_id: str, url: str) -> None:
    """Un CV como los de antes del 2026-11-19: la URL pública en el perfil."""
    async with session_factory() as session:
        row = await session.get(WorkerProfileModel, UUID(profile_id))
        row.cv_url = url
        await session.commit()


VIEJO_URL = "https://res.cloudinary.com/oido-test/image/upload/v17/oido/cv/{}.pdf"


async def test_un_cv_viejo_publico_se_sigue_viendo_hasta_migrarlo(
    client, session_factory, evidence_storage, cloudinary_on
):
    worker, profile_id = await _worker_with_profile(client, "cvp_viejo@test.com")
    url = VIEJO_URL.format("aaa")
    await _set_legacy_cv(session_factory, profile_id, url)

    assert (await _link(client, profile_id, worker)).json() == {"url": url, "expires_at": None}
    # Guardar el perfil sin tocar el CV lo conserva; cambiarlo no borra el
    # viejo (lo borra el script, que mira la carpeta).
    assert (await _put_cv(client, worker, cv_url=url)).status_code == 200
    assert (await _me(client, worker))["cv_url"] == url
    nuevo = _cv((await _me(client, worker))["user_id"])
    assert (await _put_cv(client, worker, cv_file=nuevo)).status_code == 200
    assert evidence_storage.deleted == []


# --- Script de migración ------------------------------------------------------


async def _run(session_factory, admin, apply):
    return await script.run(session_factory, admin, apply=apply, out=lambda _: None, now=AHORA)


async def _profile(session_factory, profile_id: str) -> WorkerProfileModel:
    async with session_factory() as session:
        return await session.get(WorkerProfileModel, UUID(profile_id))


async def test_el_script_por_defecto_solo_mira(client, session_factory, cloudinary_on):
    _, profile_id = await _worker_with_profile(client, "cvs_mira@test.com")
    await _set_legacy_cv(session_factory, profile_id, VIEJO_URL.format("bbb"))
    admin = FakeAdmin([_asset("oido/cv/bbb", "pdf"), _asset("oido/cv/huerfano", "pdf")])

    report = await _run(session_factory, admin, apply=False)

    assert (report.rows_migrated, report.files_protected, report.orphans_deleted) == (1, 1, 1)
    assert (admin.protected, admin.deleted) == ([], [])
    row = await _profile(session_factory, profile_id)
    assert (row.cv_url, row.cv_public_id) == (VIEJO_URL.format("bbb"), None)


async def test_el_script_pasa_a_privado_lo_que_apunta_un_perfil_y_borra_lo_demas(
    client, session_factory, cloudinary_on
):
    _, viejo = await _worker_with_profile(client, "cvs_viejo@test.com")
    await _set_legacy_cv(session_factory, viejo, VIEJO_URL.format("ccc"))
    _, foto = await _worker_with_profile(client, "cvs_foto@test.com")
    await _set_legacy_cv(
        session_factory, foto, "https://res.cloudinary.com/oido-test/image/upload/v1/oido/perfiles/f.jpg"
    )
    _, pegado = await _worker_with_profile(client, "cvs_pegado@test.com")
    await _set_legacy_cv(session_factory, pegado, "https://drive.example/cv")
    nuevo_worker, _ = await _worker_with_profile(client, "cvs_nuevo@test.com")
    nuevo = _cv((await _me(client, nuevo_worker))["user_id"])
    assert (await _put_cv(client, nuevo_worker, cv_file=nuevo)).status_code == 200

    admin = FakeAdmin(
        [
            _asset("oido/cv/ccc", "pdf"),  # CV viejo de un perfil: a privado
            _asset("oido/perfiles/f"),  # una foto pegada como CV: no se toca
            _asset(nuevo["public_id"], "pdf", "authenticated"),  # CV nuevo: no se toca
            _asset("oido/cv/cambiado", "pdf"),  # CV que se cambió antes: se borra
            _asset("oido/cv/sacado.docx", "", "authenticated", rt="raw"),  # ídem
            _asset("oido/cv/recien", "pdf", "authenticated", created_at=AHORA),  # sin guardar
        ]
    )
    report = await _run(session_factory, admin, apply=True)

    assert admin.protected == ["oido/cv/ccc"]
    assert sorted(admin.deleted) == ["oido/cv/cambiado", "oido/cv/sacado.docx"]
    assert report.recent_skipped == 1
    assert len(report.problems) == 1 and "oido/perfiles" in report.problems[0]

    migrated = await _profile(session_factory, viejo)
    assert migrated.cv_url is None
    assert (migrated.cv_public_id, migrated.cv_resource_type, migrated.cv_format) == (
        "oido/cv/ccc",
        "image",
        "pdf",
    )
    assert migrated.cv_delivery_type == "authenticated"
    assert (await _profile(session_factory, pegado)).cv_url == "https://drive.example/cv"
    assert (await _profile(session_factory, foto)).cv_public_id is None

    again = await _run(session_factory, admin, apply=True)
    assert (again.rows_migrated, again.files_protected, again.orphans_deleted) == (0, 0, 0)


async def test_el_script_no_toca_un_archivo_que_apuntan_dos_perfiles(
    client, session_factory, cloudinary_on
):
    for email in ("cvs_dos_a@test.com", "cvs_dos_b@test.com"):
        _, profile_id = await _worker_with_profile(client, email)
        await _set_legacy_cv(session_factory, profile_id, VIEJO_URL.format("compartido"))
    admin = FakeAdmin([_asset("oido/cv/compartido", "pdf")])

    report = await _run(session_factory, admin, apply=True)

    assert (admin.protected, admin.deleted) == ([], [])
    assert len(report.problems) == 2


async def test_el_script_protege_un_cv_private(client, session_factory, cloudinary_on):
    """Un CV con referencia `private` (no debería haber en producción, pero el
    script los pasa igual): queda `authenticated`."""
    _, profile_id = await _worker_with_profile(client, "cvs_private@test.com")
    async with session_factory() as session:
        row = await session.get(WorkerProfileModel, UUID(profile_id))
        row.cv_public_id, row.cv_resource_type = "oido/cv/priv", "image"
        row.cv_format, row.cv_delivery_type = "pdf", "private"
        await session.commit()
    admin = FakeAdmin([_asset("oido/cv/priv", "pdf", "private")])

    report = await _run(session_factory, admin, apply=True)

    assert admin.protected == ["oido/cv/priv"]
    assert report.rows_migrated == 1
    assert (await _profile(session_factory, profile_id)).cv_delivery_type == "authenticated"


async def test_el_script_recorre_la_raiz_los_cv_de_antes_de_las_carpetas(
    client, session_factory, cloudinary_on
):
    """Antes del 2026-10-15 los CV subían sin carpeta. Un Word o un PDF que
    nadie usa se borra; una foto que nadie usa se lista para mirarla a mano;
    lo que usa otra cosa no se toca."""
    _, viejo = await _worker_with_profile(client, "cvs_raiz@test.com")
    await _set_legacy_cv(
        session_factory, viejo, "https://res.cloudinary.com/oido-test/raw/upload/v1/cvraiz.docx"
    )
    foto_worker, foto_id = await _worker_with_profile(client, "cvs_raiz_foto@test.com")
    async with session_factory() as session:
        row = await session.get(WorkerProfileModel, UUID(foto_id))
        row.photo_url = "https://res.cloudinary.com/oido-test/image/upload/v1/fotoperfil.jpg"
        await session.commit()

    admin = FakeAdmin(
        [
            _asset("cvraiz.docx", "", rt="raw"),  # CV viejo de un perfil: se protege
            _asset("huerfano.docx", "", rt="raw"),  # Word que nadie usa: se borra
            _asset("huerfano", "pdf"),  # PDF que nadie usa: se borra
            _asset("fotoperfil"),  # foto de perfil en uso: ni se toca ni se lista
            _asset("suelta", "png"),  # foto que nadie usa: se lista
            _asset("reciente", "pdf", created_at=AHORA),  # recién subido: no se toca
            _asset("dinamica", "pdf", folder="oido/perfiles"),  # tiene carpeta
        ]
    )
    report = await _run(session_factory, admin, apply=True)

    assert admin.protected == ["cvraiz.docx"]
    assert sorted(admin.deleted) == ["huerfano", "huerfano.docx"]
    assert len(report.to_review) == 1 and "suelta" in report.to_review[0]
    assert report.recent_skipped == 1
    assert (await _profile(session_factory, viejo)).cv_public_id == "cvraiz.docx"

    # En modo «mira» no se toca nada.
    admin2 = FakeAdmin([_asset("otro.docx", "", rt="raw")])
    dry = await _run(session_factory, admin2, apply=False)
    assert dry.orphans_deleted == 1 and admin2.deleted == []


async def test_el_script_no_toca_un_archivo_sin_carpeta_que_es_una_foto(
    client, session_factory, cloudinary_on
):
    """Revisión del 2026-11-19: un archivo de antes de las carpetas pegado
    como CV que también es la foto de perfil (o un logo, o una portada) de
    alguien. Protegerlo rompía la foto."""
    url = "https://res.cloudinary.com/oido-test/image/upload/v1/legacyfoto.jpg"
    _, perfil = await _worker_with_profile(client, "cvs_foto_raiz@test.com")
    async with session_factory() as session:
        row = await session.get(WorkerProfileModel, UUID(perfil))
        row.cv_url = url
        row.photo_url = url
        await session.commit()
    admin = FakeAdmin([_asset("legacyfoto", "jpg")])

    report = await _run(session_factory, admin, apply=True)

    assert (admin.protected, admin.deleted) == ([], [])
    assert len(report.problems) == 1 and "legacyfoto" in report.problems[0]
    assert (await _profile(session_factory, perfil)).cv_url == url


async def test_el_script_no_pisa_un_cv_que_cambio_mientras_corria(
    client, session_factory, cloudinary_on
):
    """Revisión del 2026-11-19: entre que el script lee el perfil y lo
    escribe, la persona pega otro CV. La escritura es condicional: no se pisa."""
    _, profile_id = await _worker_with_profile(client, "cvs_carrera@test.com")
    await _set_legacy_cv(session_factory, profile_id, VIEJO_URL.format("carrera"))
    nuevo = "https://drive.example/cv-nuevo"

    @asynccontextmanager
    async def con_carrera():
        async with session_factory() as session:
            original = session.execute

            async def execute(statement, *args, **kwargs):
                if getattr(statement, "is_update", False):
                    # La persona guarda su perfil justo antes.
                    await original(
                        sa_update(WorkerProfileModel)
                        .where(WorkerProfileModel.id == UUID(profile_id))
                        .values(cv_url=nuevo)
                    )
                return await original(statement, *args, **kwargs)

            session.execute = execute
            yield session

    admin = FakeAdmin([_asset("oido/cv/carrera", "pdf")])
    report = await script.run(con_carrera, admin, apply=True, out=lambda _: None, now=AHORA)

    row = await _profile(session_factory, profile_id)
    assert (row.cv_url, row.cv_public_id) == (nuevo, None)
    assert report.rows_migrated == 0
    assert any("cambió mientras corría" in p for p in report.problems)

