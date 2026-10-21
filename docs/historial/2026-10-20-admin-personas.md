# Personas en el panel de admin: buscador, filtros y ficha

**Pedido:** paso 2 del panel de admin ordenado (Julieta, 2026-10-20). En
"Personas" no se podía buscar a nadie ni ver su historia en un lugar.

**Qué cambió:** `/admin/personas` tiene un buscador por nombre o email y
filtros (trabajadores, comercios, admins, sin verificar, suspendidos), con
"Ver más" de a 50. Cada fila abre la ficha `/admin/personas/[id]`: datos de
la cuenta; reputación del trabajador (turnos completados, calificación,
puntualidad, nivel, cancelaciones, ausencias) o datos del comercio (turnos
publicados, pago a tiempo, cancelaciones tardías); los últimos 5 turnos y
tickets; y las acciones (ver como, verificar, suspender o reactivar, hacer
admin). Suspender y hacer admin ahora piden confirmación.

Técnico: `UserRepository.list_all` suma `search` (nombre o email, sin
distinguir mayúsculas y con `%`/`_` escapados), `role`, `status` y
`verified`; `GET /admin/users` los expone como `q`, `role`, `status` y
`verified`. Nuevo `GET /admin/users/{id}` (`AdminService.get_user_detail`,
404 si no existe), que lee perfil, turnos y tickets por los puertos de cada
módulo (`SupportTicketRepository` se suma al servicio). Frontend en
`app/admin/personas/` y etiquetas en `components/admin/people.ts`.

**Por qué así:** la búsqueda va al backend (no se filtra en el navegador)
porque la lista viene paginada. Las acciones pasaron de cada tarjeta a la
ficha: la lista sirve para encontrar, la ficha para decidir.

**Queda abierto:** pasos 3 y 4 (ver `STATUS.md`).
