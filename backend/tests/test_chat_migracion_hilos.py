"""Relleno de la migración 0045: a qué hilo va cada mensaje que ya existía.

Antes de la 0045 los mensajes no decían con quién se estaba hablando. La
migración lo deduce con una regla conservadora (está explicada en su
docstring): lo que escribió un trabajador es de su hilo; lo que escribió el
comercio entra a un hilo sólo si el turno tuvo una única persona; ante la duda
queda sin hilo y la app no se lo muestra a nadie.

El test arma los casos con la app (que ya escribe cada mensaje en su hilo),
borra la columna nueva como si los mensajes fueran anteriores a la migración y
corre las MISMAS sentencias SQL que corre `upgrade()`.
"""

import importlib.util
from pathlib import Path

from httpx import AsyncClient
from sqlalchemy import select, text

from app.modules.chat.infrastructure.models import ChatMessageModel
from tests.test_chat_hilos import (
    Persona,
    _asignar,
    _comercio,
    _cuerpos,
    _desasignar,
    _enviar,
    _trabajador,
    _turno_publicado,
)

MIGRACION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "0045_chat_por_asignacion.py"
)


def _relleno() -> tuple[str, ...]:
    spec = importlib.util.spec_from_file_location("migracion_0045", MIGRACION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.RELLENO


async def _postular(client: AsyncClient, shift_id: str, persona: Persona):
    applied = await client.post(
        f"/api/v1/applications/shifts/{shift_id}", headers=persona.headers
    )
    assert applied.status_code == 201


async def test_el_relleno_asigna_hilo_solo_cuando_no_hay_duda(
    client: AsyncClient, session_factory
):
    comercio = await _comercio(client, "relleno_emp@staffya.com")
    ana = await _trabajador(client, "relleno_w1@staffya.com", "Persona Uno")
    beto = await _trabajador(client, "relleno_w2@staffya.com", "Persona Dos")

    # A. Una sola persona en toda la vida del turno, y los dos escribieron.
    una_sola = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, una_sola, ana)
    await _enviar(client, comercio, una_sola, "A comercio")
    await _enviar(client, ana.headers, una_sola, "A trabajador")

    # B. La persona asignada nunca escribió: igual es la única del turno.
    callada = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, callada, ana)
    await _enviar(client, comercio, callada, "B comercio")

    # C. Quien escribió ya no tiene el turno y no se asignó a nadie más.
    reabierto = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, reabierto, ana)
    await _enviar(client, comercio, reabierto, "C comercio")
    await _enviar(client, ana.headers, reabierto, "C trabajador")
    await _desasignar(client, "rechazo", reabierto, comercio, ana)

    # D. Reasignado y las dos personas escribieron.
    dos_escribieron = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, dos_escribieron, ana)
    await _enviar(client, comercio, dos_escribieron, "D comercio a la primera")
    await _enviar(client, ana.headers, dos_escribieron, "D primera")
    await _desasignar(client, "baja", dos_escribieron, comercio, ana)
    await _asignar(client, comercio, dos_escribieron, beto)
    await _enviar(client, comercio, dos_escribieron, "D comercio a la segunda")
    await _enviar(client, beto.headers, dos_escribieron, "D segunda")

    # E. Reasignado; la persona de hoy todavía no escribió.
    nueva_callada = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, nueva_callada, ana)
    await _enviar(client, comercio, nueva_callada, "E comercio a la primera")
    await _enviar(client, ana.headers, nueva_callada, "E primera")
    await _desasignar(client, "rechazo", nueva_callada, comercio, ana)
    await _asignar(client, comercio, nueva_callada, beto)
    await _enviar(client, comercio, nueva_callada, "E comercio a la segunda")

    # F. La primera persona no escribió y quedó registrada como ausente.
    con_ausencia = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, con_ausencia, ana)
    await _enviar(client, comercio, con_ausencia, "F comercio a la primera")
    await _desasignar(client, "ausencia", con_ausencia, comercio, ana)
    await _asignar(client, comercio, con_ausencia, beto)
    await _enviar(client, comercio, con_ausencia, "F comercio a la segunda")

    # G. La primera persona no escribió, pero su postulación quedó aceptada.
    con_postulacion = await _turno_publicado(client, comercio)
    await _postular(client, con_postulacion, ana)
    await _asignar(client, comercio, con_postulacion, ana)
    await _enviar(client, comercio, con_postulacion, "G comercio a la primera")
    await _desasignar(client, "rechazo", con_postulacion, comercio, ana)
    await _asignar(client, comercio, con_postulacion, beto)
    await _enviar(client, comercio, con_postulacion, "G comercio a la segunda")

    # H. No quedó rastro de con quién hablaba el comercio.
    sin_rastro = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, sin_rastro, ana)
    await _enviar(client, comercio, sin_rastro, "H comercio")
    await _desasignar(client, "rechazo", sin_rastro, comercio, ana)

    async with session_factory() as session:
        # Como estaban antes de la migración: sin persona del hilo.
        await session.execute(text("UPDATE chat_messages SET worker_user_id = NULL"))
        for sentencia in _relleno():
            await session.execute(text(sentencia))
        await session.commit()
        result = await session.execute(select(ChatMessageModel))
        hilo = {
            m.body: str(m.worker_user_id) if m.worker_user_id else None
            for m in result.scalars().all()
        }

    assert hilo == {
        # Una única persona: todo el turno es su hilo.
        "A comercio": ana.user_id,
        "A trabajador": ana.user_id,
        "B comercio": ana.user_id,
        "C comercio": ana.user_id,
        "C trabajador": ana.user_id,
        # Más de una persona: lo de cada trabajador va a su hilo; lo del
        # comercio queda sin hilo porque no se sabe a cuál le hablaba.
        "D comercio a la primera": None,
        "D primera": ana.user_id,
        "D comercio a la segunda": None,
        "D segunda": beto.user_id,
        "E comercio a la primera": None,
        "E primera": ana.user_id,
        "E comercio a la segunda": None,
        "F comercio a la primera": None,
        "F comercio a la segunda": None,
        "G comercio a la primera": None,
        "G comercio a la segunda": None,
        # Ninguna persona identificable: sin hilo.
        "H comercio": None,
    }

    # Lo que quedó sin hilo sigue guardado, pero no se le muestra a nadie; lo
    # que sí tiene hilo lo ven sus dos partes.
    assert await _cuerpos(client, ana.headers, una_sola) == ["A comercio", "A trabajador"]
    assert await _cuerpos(client, comercio, una_sola) == ["A comercio", "A trabajador"]
    assert await _cuerpos(client, beto.headers, dos_escribieron) == ["D segunda"]
    assert await _cuerpos(client, comercio, dos_escribieron) == ["D segunda"]
    for turno in (nueva_callada, con_ausencia, con_postulacion):
        assert await _cuerpos(client, beto.headers, turno) == []
        assert await _cuerpos(client, comercio, turno) == []
