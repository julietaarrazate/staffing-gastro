# Panel de admin por secciones, con portada "Hoy"

**Pedido:** Julieta sentía el panel de admin "muy genérico y poco ordenado",
y de ahí se administra el negocio y el soporte. Era una sola página larga:
cuentas de prueba arriba, después conteos, métricas y suscripciones, y la
cola de verificación y los usuarios al final.

**Qué cambió:** el panel tiene un menú (barra lateral en computadora,
pestañas en el celular) con una sección por pregunta:

- **Hoy** (`/admin`): pendientes con contador y acceso directo (identidades
  por verificar, tickets abiertos, comercios sin contactar) y la promesa de
  los 10 minutos.
- **Personas** (`/admin/personas`): usuarios y moderación, como antes.
  "Hacer admin" pasó de ámbar a botón neutro: con la lista entera había
  decenas de acentos ámbar en la pantalla.
- **Verificación** (`/admin/verificacion`), **Soporte** (`/admin/support`),
  **Crecimiento** (`/admin/leads`), **Métricas** (`/admin/metricas`) y
  **Herramientas** (`/admin/herramientas`, cuentas de prueba).

El menú muestra cuántas identidades y tickets esperan. Técnico: control de
acceso y menú en `frontend/app/admin/layout.tsx` (antes cada pantalla lo
repetía); contadores en `components/admin/AdminInbox.tsx`, que se recargan
al cambiar de sección; tarjetas de números en
`components/admin/AdminStats.tsx`. Sin cambios en el backend: usa los
endpoints que ya existían.

**Por qué así:** es la regla de "cada pantalla responde una sola pregunta"
(2026-09-28), que el panel no cumplía. Primero lo que se resuelve sin
backend; lo que necesita datos nuevos va en pasos siguientes.

**Queda abierto:** pasos 2 a 4 (ver `STATUS.md`): buscador y ficha en
Personas, Turnos en vivo, y Métricas con período.
