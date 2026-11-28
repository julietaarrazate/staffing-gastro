# Los mails con la marca vigente

**Pedido:** Julieta, 2026-11-28, al ver los mails renderizados: «los mail
tienen identidad vieja». Era además el ítem 4 de «Qué sigue» en `STATUS.md`.

**Qué cambió:** lo que ve quien recibe un mail de Oído.

- **El logo** es el pinche con la «o» (el chico y plano, a 48 px). Seguía el
  ícono anterior, las manos y la oreja sobre ámbar, que la app dejó el
  2026-11-18.
- **El fondo** es el lienzo claro de la app (`#f8fbfc`), liso. Antes llevaba
  un brillo ámbar arriba y el encabezado un toque ámbar abajo: juntos se veían
  beige, y la marca no usa crema de fondo (`marca-hoy.md`, regla 5).
- **El título** va en Inter gruesa, como los títulos de la app con la
  dirección suave. Antes pedía Bricolage Grotesque, que la app ya no usa.
- **El pie** lleva la palabra «oído» plana en azul hondo, la misma del
  encabezado de la app. Antes era texto en una serif de respaldo.
- **El ámbar** queda sólo en el botón. Los números de los pasos pasan a
  celeste con azul hondo, como los chips de la app.

**No cambió ningún texto.**

Técnico:

- `backend/app/modules/notification/domain/email_templates.py`: `_logo_img` y
  `_palabra_img` reemplazan a `_logo_svg`; se fueron `_WASH` y el ámbar de
  `_GLOW`; `_MARCA_URL` es la dirección de las imágenes.
- `frontend/public/mail/pinche.png` y `oido.png`: los escribe
  `frontend/scripts/build-icons.mjs` desde `logo-mark-chico.svg` y
  `docs/design-system/marca/oido-plano.svg`.
- `backend/tests/test_email_templates.py`: cuatro tests nuevos (el logo es
  una imagen con `alt` y no un SVG; las imágenes pedidas existen en
  `frontend/public/mail/`; el ámbar aparece sólo en el botón; no quedan las
  letras anteriores).

**Por qué así:**

- **PNG del sitio y no SVG en línea.** Gmail no muestra SVG, ni en línea ni
  como `<img>`, y tampoco acepta imágenes embebidas en `data:`. Con el SVG en
  línea que había, lo más probable es que en Gmail el mail saliera sin logo.
  Si el cliente bloquea las imágenes se lee el `alt` («Oído»).
- **La dirección de las imágenes es fija** (`https://www.oido.com.ar/mail/`)
  y no sale de `settings.frontend_url`: quien abre el mail las pide desde
  internet aunque el backend que lo mandó sea uno de prueba.
- **Inter y no Young Serif en el título:** las fuentes web casi no llegan a
  los clientes de mail, y el respaldo de Inter (Arial gruesa) se parece al
  título de la app; el de una serif, no.
- **Sin cielo en el encabezado.** Se pensó y se dejó afuera: el pedido era
  poner al día la identidad, no rediseñar el mail.

**Cómo se probó:** los tests de `test_email_templates.py`; el antes y
después renderizado de cuatro mails; y en `tools/e2e-local`, una cuenta nueva
por el camino real: los dos mails que salen (confirmar el email y la
bienvenida) traen las dos imágenes, sin SVG, y el sitio local las sirve.

**Queda abierto:**

- Mirarlos en una casilla real de Gmail y de Outlook: el arnés no prueba
  cómo se ve un mail en un cliente.
- Los textos de los mails, que esperan la revisión de voz (documento privado
  de crecimiento, pestaña «Voz y firma»).
