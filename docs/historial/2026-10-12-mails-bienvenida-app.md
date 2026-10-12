# Mails de bienvenida: bajar Oído al celular, títulos sin punto y botones legibles

**Pedido:** Julieta, 2026-10-12. Pidió mails de bienvenida para comercio y
trabajador "y los necesarios". Los de bienvenida ya existían (llegan cuando
la cuenta queda activa). Se ajustaron a lo decidido ese mismo día para la
landing: que la persona baje Oído al celular sin tecnicismos, títulos sin
punto y sin bajadas que repitan el título.

**Qué cambió:**

- **Trabajador:** el paso 1 pasa de "Activá los avisos" a **"Bajá Oído a tu
  celular"**: desde Chrome en Android (⋮ → Instalar app), desde Safari en
  iPhone (Compartir → Agregar a inicio), y "Activar" cuando la app lo pida.
- **Comercio:** el mismo paso queda segundo, después de "Publicá tu primer
  turno".
- **Títulos:** van sin punto final en todos los mails ("Ya sos parte de
  Oído", "Confirmá tu email"…) y en Bricolage Grotesque, la tipografía de
  títulos de #425. Si el cliente de mail no la carga, cae a Arial.
- **Bajadas:** se sacaron las de las bienvenidas ("La plataforma que
  conecta…"), que repetían el título.
- **Contraste:** el botón y los números de paso sobre el ámbar pasan a
  tinta. Antes iban en blanco, que da 3,19 de contraste y no pasa AA.
- **Código:** todo en
  `backend/app/modules/notification/domain/email_templates.py`. Tests
  nuevos en `tests/test_email_templates.py`: títulos sin punto, la
  bienvenida explica Chrome y Safari, y el botón ámbar no lleva blanco.

**Por qué así:** en iPhone los avisos sólo llegan con Oído agregado a la
pantalla de inicio. Sin ese paso, "Activá los avisos" no se puede cumplir.

**Queda abierto (propuesto, sin hacer):** recordatorios de activación.
Necesitan una tarea programada y suman consultas a la base de Neon (ver el
comentario del scheduler en `backend/app/core/database.py`), así que esperan
la decisión de Julieta:

- "Confirmá tu email" a las 24 h si no lo confirmó;
- comercio sin primer turno a los 2 días;
- trabajador sin avisos activados a los 3 días.
