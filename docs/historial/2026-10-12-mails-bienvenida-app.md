# Mails con la identidad nueva: paleta celeste, bajar Oído al celular y títulos sin punto

**Pedido:** Julieta, 2026-10-12. Pidió mails de bienvenida para comercio y
trabajador "y los necesarios". Los de bienvenida ya existían (llegan cuando
la cuenta queda activa). Se ajustaron a lo decidido ese mismo día para la
landing: que la persona baje Oído al celular sin tecnicismos, títulos sin
punto y sin bajadas que repitan el título.

**Qué cambió:**

- **Paleta celeste v6 en todos los mails** (Julieta: "quedaron con la
  identidad vieja"). Es la misma de la app (`:root` de `globals.css`):
  - lienzo #f3f3f3 en lugar de crema;
  - encabezado en noche #141118;
  - pasos y tarjetas en celeste #c4e3ed / #e5eef1 en lugar de manteca y
    beige;
  - links en azul hondo #1c5478;
  - tinta y grises fríos;
  - logo blanco sobre ámbar;
  - pie con el wordmark "oído" (Fraunces, como el logo).

  El petróleo de los mails de verificación queda: es el color de
  confianza que la app sigue usando. Los colores viven en constantes al
  principio de `email_templates.py`. Un test nuevo falla si vuelve alguno
  de la paleta crema.

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

**Cuarta vuelta (2026-10-13):** Julieta vio "un verde que ya no tiene que
ver con la app" y pidió los colores actuales: blanco, naranja, celeste y el
medio degradé de los planes, como la pantalla de crear cuenta. Los 8 mails
pasan a tener el lienzo `#f3f3f3` con el brillo ámbar de arriba (`--wash` de
`/register`). El encabezado deja de ser oscuro (noche o petróleo): ahora es
blanco con el `bg-glow` de la tarjeta destacada de planes, el título va en
tinta y el rótulo es una píldora celeste con texto azul hondo. El petróleo
`#1e4a47` sale de todos lados. Los mails de verificación usan el mismo
encabezado y el botón ámbar con tinta, y el sello "Perfil verificado" pasa a
celeste con azul hondo. El paso destacado y la tarjeta de "¡Te eligieron!"
llevan `bg-glow`. La caja "¿Es obligatoria?" pasa a celeste tinte con tinta.
Todo degradé lleva un `background-color` de respaldo para los clientes que
ignoran `background-image`. Tests nuevos: ningún mail usa petróleo ni un
encabezado oscuro, y todo degradé tiene color de respaldo.

**Por qué así:** en iPhone los avisos sólo llegan con Oído agregado a la
pantalla de inicio. Sin ese paso, "Activá los avisos" no se puede cumplir.

**Queda abierto (propuesto, sin hacer):** recordatorios de activación.
Necesitan una tarea programada y suman consultas a la base de Neon (ver el
comentario del scheduler en `backend/app/core/database.py`), así que esperan
la decisión de Julieta:

- "Confirmá tu email" a las 24 h si no lo confirmó;
- comercio sin primer turno a los 2 días;
- trabajador sin avisos activados a los 3 días.
