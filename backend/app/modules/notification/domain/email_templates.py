"""Plantillas HTML de los emails transaccionales, con la identidad visual de
Oído (colores/tipografía del frontend, ver `frontend/app/globals.css`).

Viven en `domain` porque son funciones puras (formatean texto, sin I/O ni
dependencia de proveedor) — mismo criterio que `EmailSender` como puerto en
este módulo: otros módulos (`identity`, `verification`) las importan sin
acoplarse a `ResendEmailSender` ni a ninguna infraestructura concreta.

Antes cada email era un `<p>` suelto compuesto a mano en el módulo que lo
mandaba (recuperar contraseña, confirmar email) — sin marca, sin jerarquía,
indistinguible de un mail de phishing. Julieta, 2026-08-26, tras ver el
onboarding de un competidor: "prolijizá los mails... dame plantillas de cómo
llegaría un registro, una validación, o un mail para validar identidad".

De esa tanda **quedó uno afuera**: el de recuperar contraseña, el único que
siguió siendo el `<p>` pelado hasta 2026-09-09, cuando Julieta pidió un reset
real para probar el dominio nuevo y le llegó justamente ése. Es el peor mail
para que se vea genérico: es el único que le pide a alguien que haga clic en
un link para cambiar una credencial, o sea exactamente lo que imita un
phishing. Que se parezca al resto de la marca no es cosmética acá.

Todos los colores salen de los tokens de `frontend/app/globals.css`. Desde
el 2026-10-13 (pedido de Julieta: "veo un verde que ya no tiene que ver con
la app") el mail lleva encabezado claro con el degradé celeste de la tarjeta
destacada de planes (`bg-glow`) y no usa el petróleo de la verificación.
(Hasta el 2026-11-28 llevaba además un lienzo gris con brillo ámbar arriba.)

Desde el 2026-11-28 (Julieta: "los mail tienen identidad vieja") siguen a la
marca vigente (`docs/design-system/marca-hoy.md`): el pinche con la «o» en
lugar de las manos y la oreja sobre ámbar, el lienzo claro de la app sin el
brillo ámbar (junto con el toque ámbar del encabezado se veía beige), el
título en Inter gruesa como los títulos de la app, la palabra «oído» del pie
en la letra de la marca y el ámbar sólo en el botón.

Reglas de honestidad de contenido (no cosméticas):
- El mail de verificación de identidad dice que la revisión la hace "nuestro
  equipo", NO que es instantánea ni que está respaldada por una fuente
  oficial (RENAPER) — porque hoy `VerificationMethod.ADMIN_MANUAL` es el
  único método implementado (ver `verification/domain/value_objects.py`,
  `docs/TRUST_SYSTEM.md` F5). Prometer una verificación automática que no
  existe todavía sería mentirle al trabajador sobre cómo funciona su propia
  cuenta.
- Sin el emoji de auricular/headphones en el cierre de los mails de
  bienvenida (Julieta: "oído es una jerga gastronómica, ese ícono no
  representa nada") — "¡oído!" es el grito de cocina para confirmar que se
  escuchó un pedido, no una referencia a audio/escucha literal.
"""

from html import escape

# Paleta, en un solo lugar. Antes cada hex estaba escrito a mano adentro de
# los estilos inline, y por eso el rebrand al ámbar (#315–#325) pasó de largo
# por acá: los mails siguieron saliendo con el naranja viejo `#f97316` durante
# semanas sin que nadie lo notara, porque un email no está en pantalla cuando
# uno mira la app. Con las constantes acá arriba, el próximo cambio de marca
# es un renglón y el test de `test_email_templates.py` avisa si se escapa uno.
# Paleta celeste v6 (2026-10-09, `:root` de frontend/app/globals.css): lienzo
# claro, tarjetas blancas, celeste de marca y ámbar sólo en el botón.
# Hasta el 2026-10-12 los mails seguían en la paleta crema/manteca anterior y
# hasta el 2026-10-13 con encabezado noche y el petróleo en la verificación.
_AMBAR = "#d97706"  # --color-primary: botones (con tinta encima)
_TEXTO_DESTACADO = "#1c5478"  # --color-primary-text (azul hondo): links, píldoras
_TINTA = "#111111"  # --color-ink
_TINTA_SUAVE = "#4b5563"  # --color-ink-soft
_TINTA_APAGADA = "#686572"  # --color-ink-mute
_LIENZO = "#f8fbfc"  # --background: el lienzo claro de la app
_TARJETA = "#ffffff"  # --color-card
_LINEA = "#deecf0"  # --color-line
_CELESTE = "#c4e3ed"  # --color-secondary
_CELESTE_TINTE = "#e5eef1"  # --color-surface

# El único fondo con efecto. Va siempre con `background-color` de respaldo:
# varios clientes de mail (Outlook desktop, algunos webmails) ignoran
# `background-image` y se quedan con el color liso.
# Celeste arriba a la derecha, sobre blanco. Hasta el 2026-11-28 llevaba además
# un toque ámbar abajo a la izquierda, y el lienzo un brillo ámbar arriba
# (`--wash`): juntos se veían beige, y la marca no usa crema de fondo
# (`docs/design-system/marca-hoy.md`, regla 5).
_GLOW = "radial-gradient(90% 100% at 100% 0%, rgba(196,227,237,0.95), transparent 70%)"


def _fondo_glow() -> str:
    """Estilo inline del `bg-glow`, con el blanco de respaldo."""
    return f"background-color:{_TARJETA};background-image:{_GLOW};"


# Las imágenes de la marca van como PNG servidos por el sitio público
# (`frontend/public/mail/`, los escribe `frontend/scripts/build-icons.mjs`).
# Gmail no muestra SVG, ni en línea ni como `<img>`, y no acepta imágenes
# embebidas en `data:`: un PNG con dirección pública es lo que se ve en todos
# lados. La dirección es fija (no sale de `settings.frontend_url`) porque
# quien abre el mail tiene que poder pedirla desde internet aunque el backend
# que lo mandó sea uno de prueba.
_MARCA_URL = "https://www.oido.com.ar/mail"
# Proporción de la palabra «oído» plana (el `viewBox` de `oido-plano.svg`).
_PALABRA_ANCHO_SOBRE_ALTO = 233.9 / 81


def _logo_img(size: int = 56) -> str:
    """El ícono de la app: el pinche con la palabra «oído», el mismo que se ve
    en el celular (Julieta, 2026-11-28: «el ícono que va es la miniatura de la
    app»; el chico con la «o» sola se probó y no).
    Hasta el 2026-11-28 acá seguía el ícono anterior (las manos y la oreja
    sobre ámbar), que la app dejó el 2026-11-18. El `alt` es lo que se lee si
    el cliente bloquea las imágenes."""
    return (
        f'<img src="{_MARCA_URL}/pinche.png" width="{size}" height="{size}" alt="Oído" '
        f'style="display:block;width:{size}px;height:{size}px;border-radius:13px;'
        f'font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:700;color:{_TEXTO_DESTACADO};">'
    )


def _palabra_img(height: int = 26) -> str:
    """La palabra «oído» plana en azul hondo (Shrikhand convertida a trazos):
    la misma del encabezado de la app. Una fuente web no llega a casi ningún
    cliente de mail, y con la de respaldo la marca salía en otra letra."""
    width = round(height * _PALABRA_ANCHO_SOBRE_ALTO)
    return (
        f'<img src="{_MARCA_URL}/oido.png" width="{width}" height="{height}" alt="oído" '
        f'style="display:inline-block;width:{width}px;height:{height}px;'
        f'font-family:Georgia,serif;font-size:16px;font-weight:700;color:{_TEXTO_DESTACADO};">'
    )


def _shell(
    *,
    preheader: str,
    eyebrow: str,
    title_html: str,
    subtitle_html: str,
    body_html: str,
    footer_note: str,
) -> str:
    """Esqueleto compartido por todos los emails: lienzo claro liso, header
    claro con `bg-glow` + card blanca + pie con la palabra «oído». Layout con tablas + estilos inline a propósito (no CSS
    externo/flexbox): es lo único que Outlook desktop y Gmail rinden igual
    de forma consistente en HTML de email."""
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  body,table,td,a{{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}}
  table,td{{mso-table-lspace:0pt;mso-table-rspace:0pt;}}
  img{{-ms-interpolation-mode:bicubic;border:0;line-height:100%;outline:none;text-decoration:none;}}
  body{{margin:0;padding:0;width:100%!important;background-color:{_LIENZO};}}
</style>
</head>
<body style="margin:0;padding:0;background-color:{_LIENZO};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:{_LIENZO};">
    {preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{_LIENZO};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="{_fondo_glow()}border:1px solid {_LINEA};border-bottom:none;border-radius:24px 24px 0 0;padding:32px 32px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="padding-right:14px;">{_logo_img()}</td>
                <td valign="middle">
                  <span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:{_CELESTE};color:{_TEXTO_DESTACADO};font-family:Inter,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.06em;">{eyebrow}</span>
                </td>
              </tr></table>
              <h1 style="margin:18px 0 6px;font-family:Inter,Arial,sans-serif;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:{_TINTA};">{title_html}</h1>
              {f'<p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.55;color:{_TINTA_SUAVE};">{subtitle_html}</p>' if subtitle_html else ""}
            </td>
          </tr>
          <tr>
            <td style="background-color:{_TARJETA};border:1px solid {_LINEA};border-radius:0 0 24px 24px;padding:32px;">
              {body_html}
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding:22px 8px 0;text-align:center;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:{_TINTA_APAGADA};">
              {_palabra_img()}<br>
              Oído · Buenos Aires, Argentina<br>
              {footer_note}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _step_box(
    number: int,
    title: str,
    description: str,
    *,
    accent: str | None = None,
    optional: bool = False,
) -> str:
    """`accent` distingue el paso que más importa: "destacado" lleva el
    `bg-glow` de la tarjeta destacada de planes, "tinte" el celeste tinte de
    las superficies de la app y el resto va blanco con borde. El número va
    en celeste con azul hondo, como los chips de la app: el ámbar queda sólo
    en el botón (un solo ámbar por pantalla)."""
    fondo = {
        "destacado": f"{_fondo_glow()}border:1px solid {_LINEA};",
        "tinte": f"background-color:{_CELESTE_TINTE};border:1px solid {_CELESTE_TINTE};",
    }.get(accent or "", f"background-color:{_TARJETA};border:1px solid {_LINEA};")
    optional_span = (
        f' <span style="text-transform:none;font-weight:500;color:{_TINTA_APAGADA};">(opcional)</span>'
        if optional
        else ""
    )
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="{fondo}border-radius:16px;margin-bottom:12px;">
  <tr><td style="padding:16px 18px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="padding-right:12px;width:26px;">
        <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background-color:{_CELESTE};color:{_TEXTO_DESTACADO};font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:700;border-radius:8px;">{number}</span>
      </td>
      <td>
        <p style="margin:0 0 3px;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.03em;color:{_TINTA};text-transform:uppercase;">{title}{optional_span}</p>
        <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.5;color:{_TINTA_SUAVE};">{description}</p>
      </td>
    </tr></table>
  </td></tr>
</table>"""


def _cta_button(label: str, link: str) -> str:
    # Un solo botón en todos los mails: ámbar con tinta encima. El blanco da
    # 3.19 y no pasa AA (misma regla que los botones de la app, COLOR_SYSTEM).
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 4px;">
  <tr><td style="border-radius:999px;background-color:{_AMBAR};">
    <a href="{link}" style="display:inline-block;padding:14px 34px;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:700;color:{_TINTA};text-decoration:none;border-radius:999px;">{label}</a>
  </td></tr>
</table>"""


def render_welcome_worker_email_html(full_name: str, link: str) -> str:
    """Bienvenida a un trabajador. Llega cuando la cuenta queda activa: al
    confirmar el email o, con Google, al crearla.

    Para ese momento el trabajador ya pasó por `/bienvenida` (el registro lo
    lleva directo ahí), así que el mail NO repite zona y oficio: hasta el
    2026-09-26 le pedía exactamente lo que acababa de cargar. Estos son los
    pasos que el onboarding no cubre y que deciden si le llegan turnos."""
    body = f"""
    <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Hola {escape(full_name)},</p>
    <p style="margin:0 0 20px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Gracias por sumarte. Tu cuenta ya está activa. Esto es lo que hace que te lleguen turnos:</p>
    {_step_box(1, "Bajá Oído a tu celular", "Desde Chrome en Android: tocá los tres puntos ⋮ y elegí <strong>Instalar app</strong>. Desde Safari en iPhone: tocá Compartir y elegí <strong>Agregar a inicio</strong>. Abrila desde el ícono y tocá Activar cuando te lo pida: así te avisamos al instante cuando un comercio cerca tuyo necesita a alguien.", accent="destacado")}
    {_step_box(2, "Verificá tu identidad", "Subí tu DNI y una selfie desde tu perfil. Cuando un comercio mira a quién elegir, ve el sello de perfil verificado.", accent="tinte")}
    {_step_box(3, "Postulate a tu primer turno", "Elegí uno del feed y tocá Postularme. Si dejaste tu zona o tu oficio para después, cargalos en tu perfil para ver los turnos que te sirven.")}
    {_cta_button("Ver turnos cerca", link)}
    <p style="margin:24px 0 0;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:{_TINTA};">Cualquier duda, respondé este mail.</p>
    <p style="margin:4px 0 0;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:{_TINTA};">¡Bienvenido/a!<br><strong>El equipo de Oído</strong></p>
    """
    return _shell(
        preheader="Bajá Oído a tu celular y empezá a recibir turnos cerca tuyo.",
        eyebrow="TRABAJADOR · CUENTA NUEVA",
        title_html="Ya sos parte de Oído",
        subtitle_html="",
        body_html=body,
        footer_note="Recibís este mail porque te registraste en Oído.",
    )


def render_welcome_employer_email_html(full_name: str, link: str) -> str:
    """Bienvenida a un comercio. Mismo criterio que la del trabajador: el
    nombre del local y la ubicación ya los cargó en `/bienvenida`, así que el
    mail habla de lo que sigue."""
    body = f"""
    <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Hola {escape(full_name)},</p>
    <p style="margin:0 0 20px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Gracias por sumar tu local. Tu cuenta ya está activa. Así cubrís tu primer turno:</p>
    {_step_box(1, "Publicá tu primer turno", 'Contale al asistente qué necesitás en una frase ("un mozo para el sábado a la noche, pago 45 mil") y te lo arma. Vos revisás y publicás.', accent="destacado")}
    {_step_box(2, "Bajá Oído a tu celular", "Desde Chrome en Android: tocá los tres puntos ⋮ y elegí <strong>Instalar app</strong>. Desde Safari en iPhone: tocá Compartir y elegí <strong>Agregar a inicio</strong>. Abrila desde el ícono y tocá Activar cuando te lo pida: te avisamos cuando alguien se postula, para que elijas antes de que se vaya a otro turno.", accent="tinte")}
    {_step_box(3, "Verificá tu comercio", "Subí tu constancia de AFIP desde tu perfil. Los trabajadores ven el sello de Comercio verificado y se postulan con más confianza.")}
    {_cta_button("Publicar un turno", link)}
    <p style="margin:24px 0 0;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:{_TINTA};">Cualquier duda, respondé este mail.</p>
    <p style="margin:4px 0 0;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:{_TINTA};">¡Bienvenido/a!<br><strong>El equipo de Oído</strong></p>
    """
    return _shell(
        preheader="Tres pasos para cubrir tu primer turno.",
        eyebrow="COMERCIO · CUENTA NUEVA",
        title_html="Ya sos parte de Oído",
        subtitle_html="",
        body_html=body,
        footer_note="Recibís este mail porque registraste un comercio en Oído.",
    )


def render_confirm_email_html(full_name: str, link: str) -> str:
    """Confirmación de email al registrarse — reemplaza el `<p>` plano
    anterior de `identity/application/services.py`."""
    body = f"""
    <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Hola {full_name},</p>
    <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Gracias por registrarte en Oído. Confirmá tu dirección de email para activar tu cuenta — el enlace vence en 48 horas.</p>
    {_cta_button("Confirmar mi email", link)}
    <p style="margin:20px 0 0;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:{_TINTA_APAGADA};text-align:center;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
      <a href="{link}" style="color:{_TEXTO_DESTACADO};word-break:break-all;">{link}</a>
    </p>
    <hr style="border:none;border-top:1px solid {_LINEA};margin:24px 0;">
    <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:13px;line-height:1.6;color:{_TINTA_APAGADA};">Si vos no creaste esta cuenta, podés ignorar este mensaje — no se va a activar nada sin confirmar.</p>
    """
    return _shell(
        preheader="Un paso más para activar tu cuenta. El enlace vence en 48 horas.",
        eyebrow="CONFIRMÁ TU CUENTA",
        title_html="Confirmá tu email",
        subtitle_html="",
        body_html=body,
        footer_note="",
    )


def render_password_reset_email_html(full_name: str, link: str, expires_in_hours: int) -> str:
    """Recuperación de contraseña — el único mail que le pide a alguien hacer
    clic para cambiar una credencial.

    Tres decisiones que no son de estilo:

    1. **`expires_in_hours` es un parámetro, no texto fijo.** El emisor lo pasa
       desde `PASSWORD_RESET_TOKEN_TTL`, así que el mail no puede quedar
       diciendo "1 hora" si mañana el TTL cambia a 30 minutos. El `<p>` que
       este template reemplaza tenía el "1 hora" escrito a mano, sin ninguna
       relación con la constante que realmente vence el token.
    2. **Dice qué pasa si NO fue el usuario**, y dice lo que de verdad pasa:
       la contraseña actual sigue funcionando y no hay que hacer nada. "Ignorá
       este mensaje" a secas deja a la persona sin saber si su cuenta quedó
       comprometida.
    3. **El link completo se muestra en texto**, además del botón. En un mail
       de credenciales, poder leer a dónde apunta antes de tocar es lo que
       separa esto de un phishing — y es lo que un cliente que no renderiza
       botones (o un lector de pantalla) necesita igual.
    """
    body = f"""
    <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Hola {full_name},</p>
    <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Recibimos un pedido para restablecer la contraseña de tu cuenta de Oído. Elegí una nueva desde acá — el enlace vence en {expires_in_hours} hora{"s" if expires_in_hours != 1 else ""}.</p>
    {_cta_button("Elegir una contraseña nueva", link)}
    <p style="margin:20px 0 0;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:{_TINTA_APAGADA};text-align:center;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
      <a href="{link}" style="color:{_TEXTO_DESTACADO};word-break:break-all;">{link}</a>
    </p>
    <hr style="border:none;border-top:1px solid {_LINEA};margin:24px 0;">
    <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:13px;line-height:1.6;color:{_TINTA_APAGADA};"><strong style="color:{_TINTA_SUAVE};">¿No pediste esto?</strong> Podés ignorar este mensaje. Tu contraseña actual sigue funcionando y no cambia nada hasta que alguien abra el enlace de arriba.</p>
    """
    return _shell(
        preheader=f"Elegí una contraseña nueva. El enlace vence en {expires_in_hours} hora{'s' if expires_in_hours != 1 else ''}.",
        eyebrow="SEGURIDAD DE TU CUENTA",
        title_html="Restablecé tu contraseña",
        subtitle_html="",
        body_html=body,
        footer_note="Recibís este mail porque se pidió restablecer la contraseña de esta cuenta.",
    )


def render_google_claimed_account_email_html(full_name: str, recover_link: str) -> str:
    """Aviso de que alguien entró con Google a una cuenta cuyo mail nunca se
    había confirmado (`IdentityService._claim_unverified_account`).

    Va al mail de la cuenta y a nadie más. A propósito no lleva IP, dispositivo
    ni nombre de quien entró: sólo lo que pasó y qué hacer. Dice la
    consecuencia real (la contraseña anterior dejó de servir y se cerraron las
    sesiones) y cómo volver a tener contraseña, para que quien creó la cuenta
    con contraseña no quede sin entender por qué ya no entra."""
    body = f"""
    <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Hola {escape(full_name)},</p>
    <p style="margin:0 0 12px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Se entró a Oído con la cuenta de Google de este mail, por primera vez.</p>
    <p style="margin:0 0 12px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Como el mail de esta cuenta nunca se había confirmado, la contraseña anterior dejó de servir y se cerraron las sesiones que estaban abiertas.</p>
    <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Desde ahora se entra con Google. Si preferís volver a tener contraseña, pedila desde «¿Olvidaste tu contraseña?» y te mandamos un link para elegir una nueva.</p>
    {_cta_button("Recuperar mi contraseña", recover_link)}
    <p style="margin:20px 0 0;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:{_TINTA_APAGADA};text-align:center;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
      <a href="{recover_link}" style="color:{_TEXTO_DESTACADO};word-break:break-all;">{recover_link}</a>
    </p>
    <hr style="border:none;border-top:1px solid {_LINEA};margin:24px 0;">
    <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:13px;line-height:1.6;color:{_TINTA_APAGADA};"><strong style="color:{_TINTA_SUAVE};">¿No fuiste vos?</strong> Escribinos a <a href="mailto:hola@oido.com.ar" style="color:{_TEXTO_DESTACADO};">hola@oido.com.ar</a> y lo revisamos.</p>
    """
    return _shell(
        preheader="Se entró a tu cuenta con Google. La contraseña anterior dejó de servir.",
        eyebrow="SEGURIDAD DE TU CUENTA",
        title_html="Se entró a tu cuenta con Google",
        subtitle_html="",
        body_html=body,
        footer_note="Recibís este mail porque se entró con Google a la cuenta de este mail.",
    )


def render_identity_verification_email_html(full_name: str, profile_link: str) -> str:
    """Invitación a verificar identidad (DNI + selfie). Lo que es confianza
    (el sello, "¿Para qué te sirve?") se marca con celeste y azul hondo; hasta
    el 2026-10-13 iba en petróleo, un verde que la app ya no usa.

    IMPORTANTE: hoy la revisión es `admin_manual` (ver
    `verification/domain/value_objects.py`) — no instantánea, no respaldada
    por RENAPER. El copy dice "nuestro equipo revisa tu documento", nunca
    "verificación instantánea", para no prometer una capacidad que Oído
    todavía no tiene (F5 en `docs/TRUST_SYSTEM.md`)."""
    body = f"""
    <p style="margin:0 0 16px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Hola {full_name},</p>
    <p style="margin:0 0 20px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Ya podés verificar tu identidad en Oído y sumar la <strong>insignia de perfil verificado</strong>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{_TARJETA};border:1px solid {_LINEA};border-radius:16px;margin-bottom:22px;">
      <tr><td style="padding:14px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle" style="padding-right:12px;">
            <span style="display:inline-block;width:40px;height:40px;border-radius:999px;background-color:{_CELESTE_TINTE};text-align:center;line-height:40px;font-family:Inter,Arial,sans-serif;font-size:16px;font-weight:700;color:{_TINTA};">{full_name[:1].upper() if full_name else "?"}</span>
          </td>
          <td valign="middle">
            <p style="margin:0 0 3px;font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:700;color:{_TINTA};">{full_name}</p>
            <span style="display:inline-flex;align-items:center;padding:2px 8px 2px 6px;border-radius:999px;background-color:{_CELESTE};font-family:Inter,Arial,sans-serif;font-size:11px;font-weight:700;color:{_TEXTO_DESTACADO};">&#10003;&nbsp; Perfil verificado</span>
          </td>
        </tr></table>
      </td></tr>
    </table>
    <p style="margin:-14px 0 22px;font-family:Inter,Arial,sans-serif;font-size:11px;color:{_TINTA_APAGADA};font-style:italic;">Así se ve en tu perfil.</p>
    <p style="margin:0 0 8px;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.03em;color:{_TEXTO_DESTACADO};text-transform:uppercase;">¿Para qué te sirve?</p>
    <p style="margin:0 0 20px;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:{_TINTA_SUAVE};">Subí tu DNI y una selfie para que un comercio pueda confiar en que sos quien decís. Un perfil verificado se nota apenas entran a mirarlo:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr><td style="padding:3px 0;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.5;color:{_TINTA};"><span style="color:{_TEXTO_DESTACADO};font-weight:700;">&#10003;</span>&nbsp; Los comercios te eligen con más confianza</td></tr>
      <tr><td style="padding:3px 0;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.5;color:{_TINTA};"><span style="color:{_TEXTO_DESTACADO};font-weight:700;">&#10003;</span>&nbsp; Más seguridad para vos y para ellos</td></tr>
      <tr><td style="padding:3px 0;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.5;color:{_TINTA};"><span style="color:{_TEXTO_DESTACADO};font-weight:700;">&#10003;</span>&nbsp; Te lleva un minuto: DNI + selfie</td></tr>
    </table>
    {_cta_button("Verificar mi identidad →", profile_link)}
    <p style="margin:8px 0 22px;font-family:Inter,Arial,sans-serif;font-size:12px;color:{_TINTA_APAGADA};text-align:center;">En la plataforma: Perfil → Identidad → "Verificar identidad".</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{_CELESTE_TINTE};border-radius:16px;margin-bottom:18px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.04em;color:{_TINTA};text-transform:uppercase;">¿Es obligatoria?</p>
        <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.5;color:{_TINTA};">No — podés seguir usando Oído sin verificarte. Pero un perfil verificado genera más confianza y más consultas.</p>
      </td></tr>
    </table>
    <hr style="border:none;border-top:1px solid {_LINEA};margin:0 0 14px;">
    <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:{_TINTA_APAGADA};">Tu documento lo revisa nuestro equipo — te avisamos por acá apenas quede lista. Usamos estas imágenes sólo para verificar tu identidad y las eliminamos una vez revisadas (Ley 25.326).</p>
    """
    return _shell(
        preheader="Sumá la insignia de Perfil Verificado — te lleva un minuto.",
        eyebrow="NOVEDAD EN OÍDO",
        title_html="Verificá tu identidad<br>Que se vea que sos vos",
        subtitle_html="",
        body_html=body,
        footer_note="Recibís este mail porque tenés una cuenta de trabajador en Oído.",
    )


def render_shift_accepted_email_html(
    full_name: str, position_label: str, company_name: str, when_label: str, link: str
) -> str:
    """"Te aceptaron para un turno": el mail que decide si alguien llega.

    Hasta el 2026-09-26 era un `<p>` armado a mano en `ShiftService`, sin
    marca, con el puesto crudo ("ayudante_cocina") y la hora en UTC (un turno
    de las 20:00 decía "23:00"). `when_label` llega ya formateado en hora
    argentina (`core/tz.format_turno_art`): esta función no toca fechas.
    `company_name` lo escribe el comercio, así que se escapa."""
    body = f"""
    <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Hola {escape(full_name)},</p>
    <p style="margin:0 0 20px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};"><strong>{escape(company_name)}</strong> te eligió para este turno. Falta un paso: confirmá que vas.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="{_fondo_glow()}border:1px solid {_LINEA};border-radius:16px;margin-bottom:8px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 2px;font-family:Inter,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.04em;color:{_TINTA_SUAVE};text-transform:uppercase;">{escape(position_label)}</p>
        <p style="margin:0 0 2px;font-family:Inter,Arial,sans-serif;font-size:19px;font-weight:800;letter-spacing:-0.01em;color:{_TINTA};">{escape(company_name)}</p>
        <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:{_TINTA};">{escape(when_label)}</p>
      </td></tr>
    </table>
    {_cta_button("Confirmar que voy", link)}
    <p style="margin:18px 0 0;font-family:Inter,Arial,sans-serif;font-size:13px;line-height:1.6;color:{_TINTA_APAGADA};">Si no podés ir, avisá desde el mismo lugar: el comercio busca a otra persona a tiempo y no te afecta la reputación.</p>
    """
    return _shell(
        preheader=escape(f"{position_label} en {company_name}, {when_label}. Confirmá que vas."),
        eyebrow="TURNO ASIGNADO",
        title_html="¡Te eligieron!",
        subtitle_html="",
        body_html=body,
        footer_note="Recibís este mail porque te postulaste a un turno en Oído.",
    )


def render_verification_decision_email_html(
    full_name: str, *, approved: bool, what: str, reason: str | None, link: str
) -> str:
    """Resultado de una verificación (DNI + selfie, o constancia de AFIP).

    El mail de invitación a verificarse promete "te avisamos por acá apenas
    quede lista", y hasta el 2026-09-26 nadie avisaba: el admin decidía y la
    persona se enteraba sólo si volvía a su perfil. Si se rechaza, el motivo
    va en el mail (lo escribe el admin, así que se escapa)."""
    if approved:
        text = f"Revisamos tu {escape(what)} y quedó aprobada. El sello ya se ve en tu perfil."
        detail = ""
        title = "Verificación aprobada"
        cta = "Ver mi perfil"
    else:
        text = f"Revisamos tu {escape(what)} y no la pudimos aprobar. Podés mandarla de nuevo desde tu perfil."
        detail = (
            f"""<p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.04em;color:{_TINTA_SUAVE};text-transform:uppercase;">Motivo</p>
    <p style="margin:0 0 8px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">{escape(reason)}</p>"""
            if reason
            else ""
        )
        title = "Hay que revisar tu verificación"
        cta = "Mandarla de nuevo"
    body = f"""
    <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Hola {escape(full_name)},</p>
    <p style="margin:0 0 18px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">{text}</p>
    {detail}
    {_cta_button(cta, link)}
    <p style="margin:18px 0 0;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:{_TINTA_APAGADA};">Las imágenes que mandaste ya se borraron: las usamos sólo para esta revisión (Ley 25.326).</p>
    """
    return _shell(
        preheader=title,
        eyebrow="VERIFICACIÓN",
        title_html=title,
        subtitle_html="",
        body_html=body,
        footer_note="Recibís este mail porque pediste verificar tu cuenta en Oído.",
    )


def render_subscription_email_html(
    full_name: str, *, title: str, text: str, cta_label: str, link: str
) -> str:
    """Avisos del cobro mensual del comercio (ADR-0022): pago acreditado,
    plan por vencer, plan vencido, reembolso del arrepentimiento. Un solo
    molde: cambia el título, el texto y el botón."""
    body = f"""
    <p style="margin:0 0 4px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">Hola {escape(full_name)},</p>
    <p style="margin:0 0 18px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:{_TINTA};">{escape(text)}</p>
    {_cta_button(escape(cta_label), link)}
    <p style="margin:18px 0 0;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:{_TINTA_APAGADA};">El pago es mes a mes, sin débito automático: nunca te cobramos sin que vos pagues el link.</p>
    """
    return _shell(
        preheader=escape(title),
        eyebrow="MI PLAN",
        title_html=escape(title),
        subtitle_html="",
        body_html=body,
        footer_note="Recibís este mail porque tu comercio tiene un plan en Oído.",
    )
