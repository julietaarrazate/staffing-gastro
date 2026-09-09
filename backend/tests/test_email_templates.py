"""Plantillas de los emails transaccionales.

Estas plantillas no tenían **ningún** test, y eso costó caro dos veces:

1. El rebrand al ámbar (#315–#325) las salteó por completo: los mails
   siguieron saliendo con el naranja viejo `#f97316` durante semanas. Un mail
   no está en pantalla cuando uno mira la app, así que nadie lo vio.
2. La tanda de "prolijizá los mails" (2026-08-26) dejó afuera el de recuperar
   contraseña, que siguió siendo un `<p>` pelado hasta que Julieta pidió un
   reset real el 2026-09-09 y le llegó justamente ése.

Los dos son el mismo tipo de error: algo que sólo se ve en una bandeja de
entrada. Por eso lo que se fija acá no es el diseño (que va a cambiar) sino
los invariantes que hacen que un mail sea de Oído y no de cualquiera.
"""

from datetime import timedelta

import pytest

from app.modules.identity.application.services import PASSWORD_RESET_TOKEN_TTL
from app.modules.notification.domain.email_templates import (
    _AMBAR,
    render_confirm_email_html,
    render_identity_verification_email_html,
    render_password_reset_email_html,
    render_welcome_employer_email_html,
    render_welcome_worker_email_html,
)

_LINK = "https://oido.com.ar/restablecer?token=abc123"

# Naranja pre-rebrand y sus derivados. Ninguno existe ya en `globals.css`:
# si alguno reaparece en un mail, es que se copió de una plantilla vieja.
_COLORES_MUERTOS = ("#f97316", "#ffb27a", "#b23c08")


# Se parametriza por NOMBRE y se renderiza adentro del test, no por el HTML
# ya renderizado: pytest arma el id del caso con el valor del parámetro, así
# que pasar el HTML volcaba los 13 KB de cada mail en el id y una falla
# escupía 65 KB ilegibles.
_PLANTILLAS = {
    "bienvenida_trabajador": lambda: render_welcome_worker_email_html("Ana", _LINK),
    "bienvenida_comercio": lambda: render_welcome_employer_email_html("Bar Pepe", _LINK),
    "confirmar_email": lambda: render_confirm_email_html("Ana", _LINK),
    "verificar_identidad": lambda: render_identity_verification_email_html("Ana", _LINK),
    "recuperar_contraseña": lambda: render_password_reset_email_html("Ana", _LINK, 1),
}

todas = pytest.mark.parametrize("nombre", sorted(_PLANTILLAS))


@todas
def test_ningun_mail_usa_el_naranja_pre_rebrand(nombre: str):
    """El test que habría avisado en #315. La marca es ámbar `#d97706` desde
    el rebrand; el naranja viejo sólo puede llegar acá por copiar y pegar."""
    html = _PLANTILLAS[nombre]()
    for muerto in _COLORES_MUERTOS:
        assert muerto not in html, f"{nombre} todavía usa el color pre-rebrand {muerto}"


@todas
def test_todo_mail_lleva_la_marca_y_el_link_pedido(nombre: str):
    """Lo que separa un mail de Oído de un `<p>` suelto: el tile ámbar del
    isotipo, el pie con la marca, y el link que el emisor pidió mandar."""
    html = _PLANTILLAS[nombre]()
    assert _AMBAR in html, f"{nombre} no lleva el ámbar de marca en ningún lado"
    assert "OÍDO" in html, f"{nombre} no lleva el pie de marca"
    assert _LINK in html, f"{nombre} perdió el link que le pasaron"


@todas
def test_todo_mail_es_un_documento_html_completo(nombre: str):
    """Un fragmento sin `<!doctype>` lo renderiza cada cliente como quiere —
    que es exactamente cómo se veía el de recuperar contraseña."""
    html = _PLANTILLAS[nombre]()
    assert html.lstrip().startswith("<!doctype html>"), f"{nombre} no es un documento"
    assert 'lang="es"' in html, f"{nombre} no declara idioma"


def test_el_vencimiento_del_mail_es_el_del_token_de_verdad():
    """El `<p>` anterior decía "vence en 1 hora" escrito a mano, sin ninguna
    relación con la constante que vence el token. Si mañana el TTL baja a 30
    minutos, el mail tiene que seguirlo — o le miente a la persona sobre
    cuánto tiempo tiene."""
    horas = int(PASSWORD_RESET_TOKEN_TTL.total_seconds() // 3600)
    html = render_password_reset_email_html("Ana", _LINK, horas)

    assert f"vence en {horas} hora" in html
    # Y la pluralización tiene que acompañar, no quedar clavada en singular.
    assert "vence en 3 horas" in render_password_reset_email_html("Ana", _LINK, 3)


def test_el_mail_de_reset_dice_que_hacer_si_no_fuiste_vos():
    """No alcanza con "ignoralo": quien recibe un reset que no pidió necesita
    saber si su cuenta quedó comprometida. La respuesta real es que no cambia
    nada hasta que alguien abra el enlace."""
    html = render_password_reset_email_html("Ana", _LINK, 1)

    assert "¿No pediste esto?" in html
    assert "sigue funcionando" in html


def test_la_verificacion_de_identidad_no_promete_una_revision_automatica():
    """Hoy `VerificationMethod.ADMIN_MANUAL` es el único método implementado
    (docs/TRUST_SYSTEM.md F5). Prometer verificación instantánea o respaldo de
    RENAPER sería mentirle al trabajador sobre su propia cuenta."""
    html = render_identity_verification_email_html("Ana", _LINK)

    assert "nuestro equipo" in html
    for promesa in ("RENAPER", "instantáne", "automátic"):
        assert promesa.lower() not in html.lower(), f"el mail promete '{promesa}'"


def test_el_ttl_de_reset_sigue_siendo_de_horas_enteras():
    """La conversión del emisor (`total_seconds() // 3600`) asume horas
    enteras. Si el TTL pasara a 30 minutos, el mail diría "vence en 0 horas"
    sin que nada más falle: este test es el que avisa que hay que cambiar el
    copy a minutos, no una comprobación decorativa del valor actual."""
    assert PASSWORD_RESET_TOKEN_TTL >= timedelta(hours=1)
    assert PASSWORD_RESET_TOKEN_TTL.total_seconds() % 3600 == 0
