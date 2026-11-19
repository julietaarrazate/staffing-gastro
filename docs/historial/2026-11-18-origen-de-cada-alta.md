# Origen de cada alta y «Altas por origen» en Métricas

**Pedido:** Julieta, 2026-11-18 (fase 0 del plan de crecimiento, aprobado
ese día): que el registro guarde de dónde vino la persona (`?ref=` o los
parámetros `utm` del enlace con el que entró; si no hay, «directo») y que el
panel de admin muestre las altas por origen y por rol.

**Qué cambió:** quien entra a Oído por un enlace con `?ref=`,
`utm_source` o `utm_campaign` (cualquier página: la landing, la encuesta,
`/register`) queda con ese origen guardado en su navegador por 30 días; al
crear la cuenta, por email o con Google, el origen viaja con el alta y se
borra del navegador. En Administración → Métricas, debajo de los números del
período, la tabla «Altas por origen» cuenta las cuentas nuevas del período
(7 o 30 días) por origen, con trabajadores, comercios y total.

- Frontend: `lib/origen-alta.ts` (leer la URL, guardar en `localStorage`
  con vencimiento, leer y borrar), `components/CapturaOrigen.tsx` en el
  layout raíz, y `register` / `loginWithGoogle` en `lib/auth-context.tsx`
  mandan `origen`. La tabla es `components/admin/AltasPorOrigen.tsx`.
- Backend: `identity/domain/origen_alta.py` arma la etiqueta (`ref` gana;
  si no, `utm_source/utm_campaign`; sin nada, «directo»), la normaliza
  (minúsculas, sin tildes, sólo `a-z 0-9 . _ -`, 40 caracteres por parte) y
  el alta pública la guarda en `users.signup_origin` (migración 0056). Las
  altas internas (invitadas, de prueba, seed) quedan en NULL. El esquema del
  alta nunca rechaza un `origen` mal formado: lo ignora o lo recorta.
  `UserRepository.count_signups_by_origin` cuenta en SQL y
  `AdminService.get_period_metrics` devuelve `signups_by_origin`, sin
  cuentas de prueba, invitadas ni admins.

**Por qué así:**

- Se guarda una sola etiqueta y no los parámetros crudos: es lo que el
  panel necesita y es menos dato personal (criterio de datos adecuados y no
  excesivos de la Ley 25.326). `utm_medium` no se guarda: Instagram pone
  siempre «social» y no distingue canales.
- `localStorage` por 30 días y no `sessionStorage` (como el plan elegido):
  mucha gente ve el enlace en el celular y se da de alta otro día. Gana el
  último enlace con origen; uno sin parámetros no lo borra.
- El origen no sale en ninguna respuesta (`/auth/me`, `UserResponse`) ni en
  la ficha de la persona: sólo como conteo en Métricas.
- Las cuentas anteriores al cambio quedan «Sin dato» en vez de «directo»,
  para no inflar «directo» con altas de las que no se sabe nada.

**Privacidad:** Julieta aprobó el 2026-11-19 el texto nuevo de
`/privacidad`: «Cómo llegaste» en «Para todos» y el código guardado en el
navegador en «Cookies y almacenamiento». Versión legal `2026-11-19-1` en
`identity/domain/value_objects.py` y `frontend/lib/legal.ts`. Las cuentas
existentes no tienen que volver a aceptar nada: la versión sólo se registra
en las altas nuevas, y a esas cuentas no se les guarda origen.

**Migración:** iba a ser la 0054, pero la 0055 (decisión 22, #649) se
mergeó antes sobre la 0053; ésta quedó como 0056, sobre la 0055, para que la
cadena tenga una sola cabeza.

**Queda abierto:** nada de código. Para usarlo: códigos cortos de canal y
lugar (`ig-bio`, `wa-grupo-palermo`, `volante-villa-crespo`,
`visita-palermo`), sin nombres de personas (un enlace por persona sería un
programa de referidos, que espera la consulta legal).
