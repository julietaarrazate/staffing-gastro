# U110: reportar un turno o un comercio desde soporte (#PR)

**Pedido:** triaje de la etapa 3 de la beta (U110): un ticket de soporte no se
podía atar a un turno ni a un comercio, y la persona tenía que describir de
memoria de cuál hablaba.

**Qué cambió:**
- Dos categorías nuevas, «Un turno» (`turno`) y «Un comercio» (`comercio`), y
  una referencia opcional en el ticket: `shift_id` y `company_id`
  (`support_tickets`, migración `0048`, FK con `ON DELETE SET NULL`: si el
  turno o el comercio se borran, el ticket queda sin la referencia).
- Link discreto «Reportar un problema» (sin acento ámbar) en el detalle del
  turno (`components/ShiftDetail.tsx`), en la tarjeta del trabajador
  (`components/ShiftCard.tsx`, Mis turnos) y en el perfil público del comercio
  (`/companies/[id]`), sólo para trabajadores. Abre `/support` con el
  formulario de ticket nuevo precargado y muestra título y fecha del turno (o
  el nombre del comercio) para confirmarlo; «Quitar» lo saca. Si el servidor no
  lo puede atar, el aviso dice «No pudimos asociar…» y el ticket se manda igual,
  sin referencia (`lib/support-reference.ts`).
- Admin: `/admin/support` muestra la referencia como texto en la tarjeta (la
  tarjeta entera ya es un link); el detalle del ticket la muestra con link al
  turno (`/turno/[id]`) y a la ficha del comercio (`/admin/personas/<cuenta>`).
- Backend: `GET /support/reference?shift_id=&company_id=` (qué se va a atar,
  mismas reglas que al crear), `POST /support/tickets` acepta `shift_id` y
  `company_id`, y el detalle trae `references`.

**Quién puede atar qué (no-disclosure):** la regla vive en
`SupportService._authorize_references`; el cruce con shift, application,
company y worker es el puerto `ReferenceLookup` (sólo hechos).
- Turno: el comercio dueño; un trabajador asignado, que se postuló (cualquier
  estado de la postulación) o ante un turno abierto público (publicado o
  buscando personal, con inicio por delante y cuenta del comercio activa).
- Comercio: su propia cuenta; un trabajador que se postuló o fue asignado a un
  turno suyo, o que hoy ve un turno abierto suyo (con la cuenta activa).
- Turno y comercio juntos: el comercio tiene que ser el del turno; con sólo el
  turno, el comercio se completa solo.
- Todo lo demás, inexistente o ajeno, da el mismo 404 («No encontramos ese
  turno o comercio»). Un ticket sin referencia funciona como siempre.

**Por qué así:** ninguna tabla ni dominio nuevos de moderación (sigue sin
haber señal de abuso que lo justifique): sólo una categoría más y dos columnas.
La regla en el caso de uso y no en el adaptador para que se pueda leer y
testear sin base. El perfil del comercio lo lee cualquier sesión, pero atarlo a
un ticket exige relación con él (turno o turno abierto) para no dejar
adivinar ids.

**Queda abierto:**
- El link del admin al turno va a `/turno/[id]`, que para un turno ya no abierto
  dice «ya no está disponible»: no hay todavía una vista de turno para el admin
  (los datos del turno están en el ticket: título, fecha y comercio).
- Un comercio no puede reportar un trabajador (no hay categoría «usuario»).
- La migración se numeró `0048` de forma provisional; quien coordina la
  renumera al mergear.
