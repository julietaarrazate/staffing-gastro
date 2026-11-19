"""Relleno de la migración 0045: a qué hilo va cada mensaje que ya existía.

Antes de la 0045 los mensajes no decían con quién se estaba hablando. La
migración lo deduce con una regla conservadora (está explicada en su
docstring): lo que escribió un trabajador es de su hilo; lo que escribió el
comercio va al hilo del destinatario del aviso que generó ese mismo mensaje,
sólo si ese aviso se puede identificar sin duda; si no, queda sin hilo y la app
no se lo muestra a nadie.

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
    _bandeja,
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

    # B. La persona asignada nunca escribió.
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

    # G. La primera persona se había postulado y no escribió.
    con_postulacion = await _turno_publicado(client, comercio)
    await _postular(client, con_postulacion, ana)
    await _asignar(client, comercio, con_postulacion, ana)
    await _enviar(client, comercio, con_postulacion, "G comercio a la primera")
    await _desasignar(client, "rechazo", con_postulacion, comercio, ana)
    await _asignar(client, comercio, con_postulacion, beto)
    await _enviar(client, comercio, con_postulacion, "G comercio a la segunda")

    # H. Asignación directa; la persona se fue sin escribir y no vino otra.
    sin_reemplazo = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, sin_reemplazo, ana)
    await _enviar(client, comercio, sin_reemplazo, "H comercio")
    await _desasignar(client, "rechazo", sin_reemplazo, comercio, ana)

    # I. Asignación directa (sin postulación): la primera persona no escribió,
    # se fue sin quedar ausente y el turno pasó a otra. Su único rastro es el
    # aviso de cada mensaje que recibió.
    directo = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, directo, ana)
    await _enviar(client, comercio, directo, "I comercio a la primera")
    await _desasignar(client, "rechazo", directo, comercio, ana)
    await _asignar(client, comercio, directo, beto)
    await _enviar(client, comercio, directo, "I comercio a la segunda")

    # J. El mismo texto a las dos personas: no se sabe qué aviso es de cuál.
    repetido = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, repetido, ana)
    await _enviar(client, comercio, repetido, "J hola")
    await _desasignar(client, "baja", repetido, comercio, ana)
    await _asignar(client, comercio, repetido, beto)
    await _enviar(client, comercio, repetido, "J hola")

    # K. El aviso de la primera persona ya no está (la limpieza borra los
    # leídos viejos): sin rastro, su mensaje queda sin hilo.
    sin_aviso = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, sin_aviso, ana)
    await _enviar(client, comercio, sin_aviso, "K comercio a la primera")
    await _desasignar(client, "rechazo", sin_aviso, comercio, ana)
    await _asignar(client, comercio, sin_aviso, beto)
    await _enviar(client, comercio, sin_aviso, "K comercio a la segunda")

    # L. Mensajes largos: el aviso lleva sólo el comienzo. Uno con comienzo
    # propio se atribuye; dos que empiezan igual quedan sin hilo.
    largo = "L " + "x" * 120
    comienzo_comun = "M " + "y" * 90
    largos = await _turno_publicado(client, comercio)
    await _asignar(client, comercio, largos, ana)
    await _enviar(client, comercio, largos, largo)
    await _enviar(client, comercio, largos, comienzo_comun + " a la primera")
    await _desasignar(client, "rechazo", largos, comercio, ana)
    await _asignar(client, comercio, largos, beto)
    await _enviar(client, comercio, largos, comienzo_comun + " a la segunda")

    async with session_factory() as session:
        await session.execute(
            text("DELETE FROM notifications WHERE message = 'K comercio a la primera'")
        )
        # Como estaban antes de la migración: sin persona del hilo.
        await session.execute(text("UPDATE chat_messages SET worker_user_id = NULL"))
        for sentencia in _relleno():
            await session.execute(text(sentencia))
        await session.commit()
        hilo = await _hilos(session)
        # Repetir el relleno (reparación tras el deploy) no mueve nada.
        for sentencia in _relleno():
            await session.execute(text(sentencia))
        await session.commit()
        assert await _hilos(session) == hilo

    assert hilo == {
        # Lo de cada trabajador va a su hilo; lo del comercio, al hilo de quien
        # recibió su aviso.
        "A comercio": ana.user_id,
        "A trabajador": ana.user_id,
        "B comercio": ana.user_id,
        "C comercio": ana.user_id,
        "C trabajador": ana.user_id,
        "D comercio a la primera": ana.user_id,
        "D primera": ana.user_id,
        "D comercio a la segunda": beto.user_id,
        "D segunda": beto.user_id,
        "E comercio a la primera": ana.user_id,
        "E primera": ana.user_id,
        "E comercio a la segunda": beto.user_id,
        "F comercio a la primera": ana.user_id,
        "F comercio a la segunda": beto.user_id,
        "G comercio a la primera": ana.user_id,
        "G comercio a la segunda": beto.user_id,
        "H comercio": ana.user_id,
        "I comercio a la primera": ana.user_id,
        "I comercio a la segunda": beto.user_id,
        # Texto repetido en el turno: sin hilo los dos.
        "J hola": None,
        # Sin aviso: sin hilo. El resto del turno no cambia.
        "K comercio a la primera": None,
        "K comercio a la segunda": beto.user_id,
        largo: ana.user_id,
        comienzo_comun + " a la primera": None,
        comienzo_comun + " a la segunda": None,
    }

    # Lo que quedó sin hilo sigue guardado, pero no se le muestra a nadie; lo
    # que sí tiene hilo lo ven sus dos partes, y quien llegó después ve sólo
    # lo suyo.
    assert await _cuerpos(client, ana.headers, una_sola) == ["A comercio", "A trabajador"]
    assert await _cuerpos(client, comercio, una_sola) == ["A comercio", "A trabajador"]
    assert await _cuerpos(client, beto.headers, dos_escribieron) == [
        "D comercio a la segunda",
        "D segunda",
    ]
    for turno, letra in ((nueva_callada, "E"), (con_ausencia, "F"), (con_postulacion, "G")):
        esperado = [f"{letra} comercio a la segunda"]
        assert await _cuerpos(client, beto.headers, turno) == esperado
        assert await _cuerpos(client, comercio, turno) == esperado
    assert await _cuerpos(client, beto.headers, directo) == ["I comercio a la segunda"]
    assert await _cuerpos(client, comercio, directo) == ["I comercio a la segunda"]
    vistas = [c for c in await _bandeja(client, beto.headers) if c["shift_id"] == directo]
    assert [c["last_message"] for c in vistas] == ["I comercio a la segunda"]
    assert await _cuerpos(client, beto.headers, repetido) == []
    assert await _cuerpos(client, beto.headers, sin_aviso) == ["K comercio a la segunda"]
    assert await _cuerpos(client, beto.headers, largos) == []


async def _hilos(session) -> dict[str, str | None]:
    """Cuerpo de cada mensaje -> persona de su hilo (todos los textos que no
    se repiten son distintos a propósito)."""
    result = await session.execute(select(ChatMessageModel))
    return {
        m.body: str(m.worker_user_id) if m.worker_user_id else None
        for m in result.scalars().all()
    }
