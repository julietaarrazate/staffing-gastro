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
  el alta pública la guarda en `users.signup_origin` (migración 0054). Las
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

**Queda abierto:** el texto de `/privacidad` no lista todavía este dato ni
el almacenamiento en el navegador. Julieta pidió que se le pregunte antes de
cambiarlo; el texto propuesto está en el PR. Sin ese cambio el PR no se
mergea.
