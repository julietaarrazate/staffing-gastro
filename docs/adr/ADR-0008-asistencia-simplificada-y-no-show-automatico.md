# ADR-0008 — Asistencia en 2 pasos (en vez de 4) + no-show automático

**Estado:** aceptado · **Fecha:** 2026-08-02

## Contexto

ADR-0007 resolvió el no-show **manual** (el comercio marca "no se presentó")
y dejó explícitamente fuera de alcance la detección **automática**, con el
mismo razonamiento que ya venía de ADR-0004: requiere un scheduler que hoy no
existe en el repo — infraestructura nueva sin necesidad demostrada en su
momento.

Al revisar el flujo real de asistencia del trabajador (Julieta, sesión del
2026-08-02) surgieron dos problemas conectados:

1. **4 pasos manuales son demasiados.** El flujo pedía: "Salir hacia el
   turno" (`depart`, → `EN_CAMINO`) → "Llegué" (`check_in`, con
   geolocalización) → "Empezar a trabajar" (`start_working`, → `TRABAJANDO`)
   → "Me fui" (`check_out`, con geolocalización). En la práctica, un
   trabajador que **sí llega** pero se olvida de tocar alguno de los pasos
   intermedios queda indistinguible de uno que no llegó — cuantos más taps
   exige el flujo, más falsos "no presentado" genera, no menos.
2. **¿Por qué no detectarlo con geolocalización pasiva/continua en vez de
   pedirle que toque un botón?** Se evaluó y se descarta por una limitación
   técnica dura, no una preferencia de diseño: Oído es una **PWA** ("Agregar
   a la pantalla de inicio"), no una app nativa de App Store/Play Store. Los
   navegadores **no permiten geolocalización en segundo plano/continua** para
   web apps ni PWAs — sólo capturas puntuales mientras la pestaña/app está
   activa y el usuario interactúa. Habilitar geofencing real requeriría
   convertir Oído en una app nativa (inversión mucho mayor, fuera de alcance
   de este ADR). Lo que sí existe y se puede aprovechar: la captura de
   lat/lng puntual que ya ocurre en `check_in`/`check_out`.

La solución conjunta: **bajar la fricción** (menos pasos manuales) y
**avisar proactivamente** (push) en vez de exigir más pasos o inventar
tracking que el navegador no permite.

## Decisión

### 1. Asistencia en 2 pasos: "Llegué" / "Me fui"

- `Shift.check_in()` ahora acepta como estado previo **`CONFIRMADO` o
  `EN_CAMINO`** (antes exigía estrictamente `EN_CAMINO`, es decir, pasar por
  `depart()` primero). El trabajador puede marcar su llegada directo desde
  que confirmó el turno.
- `Shift.check_out()` ahora acepta como estado previo **`CHECK_IN` o
  `TRABAJANDO`** (antes exigía estrictamente `TRABAJANDO`, o sea pasar por
  `start_working()` primero). Se puede marcar la salida directo desde que
  hizo check-in.
- `depart()` (`CONFIRMADO` → `EN_CAMINO`) y `start_working()` (`CHECK_IN` →
  `TRABAJANDO`) **se conservan en el dominio y sus endpoints siguen
  existiendo** — no se borran — pero la UI nueva no los ofrece como paso del
  flujo. Son puramente de compatibilidad: cualquier turno que ya estuviera en
  `EN_CAMINO`/`TRABAJANDO` al desplegar este cambio sigue su curso normal
  (`check_in`/`check_out` aceptan ambos estados).
- Frontend (`/my-shifts`, vista del trabajador): el botón "Salir hacia el
  turno" se reemplaza por **"Llegué"** (dispara `check-in` con
  geolocalización, directo desde `confirmado`); el botón "Empezar a
  trabajar" se reemplaza por **"Me fui"** (dispara `check-out` con
  geolocalización, directo desde `check_in`). Los estados legacy
  `en_camino`/`trabajando` conservan su botón de continuación por si un turno
  viejo queda ahí.

### 2. Scheduler en proceso: recordatorio + no-show automático

- **Sin servicio de Cron nuevo.** El plan free de Render sólo tiene **un**
  web service (`render.yaml` define un único `services:` de `type: web`) —
  no hay Cron Job disponible sin pasar a un plan pago. En vez de eso: un loop
  `asyncio` arrancado dentro del `lifespan` que FastAPI ya usa
  (`app/main.py`), mismo mecanismo que `promote_configured_admins()`.
  Gateado a `settings.is_production` — no corre en desarrollo ni en tests
  (mismo patrón "flag por ausencia" que Sentry/VAPID/Google/Resend). Vive en
  `app/modules/shift/application/attendance_scheduler.py`.
- **Recordatorio de check-in** (`ShiftService.send_checkin_reminder`): si
  pasaron `CHECKIN_REMINDER_DELAY` (20 min, valor semilla) desde `start_at`
  sin check-in, se le manda al trabajador un push
  (`NotificationType.CHECKIN_REMINDER`) "¿Ya llegaste a tu turno?". Se manda
  **una sola vez** por turno: `Shift.checkin_reminder_sent_at` (columna
  nueva, migración `0019`) marca que ya se avisó, para no reenviarlo en cada
  tick del loop.
- **No-show automático** (`ShiftService.auto_mark_no_show`): si pasaron
  `NO_SHOW_GRACE_PERIOD` (2hs, valor semilla) desde `start_at` sin check-in,
  se marca no-show automáticamente **reutilizando** `ShiftService.mark_no_show`
  (el mismo método manual de ADR-0007, con el `company_id` real del turno) —
  sin duplicar la lógica de reabrir el turno / penalizar reputación /
  notificar al trabajador que ya existía.
- **Repositorio:** `ShiftRepository.list_awaiting_checkin()` (nuevo, sin
  paginar, uso interno no expuesto por API) trae los turnos
  `CONFIRMADO`/`EN_CAMINO` sin check-in; el scheduler compara `start_at`
  contra `now` en Python (mismo criterio que `_naive()` en
  `ShiftService`, para no pelearse con el tz-naive de SQLite en tests).
- **Intervalo del loop:** cada 5 minutos (`CHECK_INTERVAL`) — alcanza de
  sobra dado que los umbrales de arriba se miden en minutos/horas. Errores de
  una pasada no matan el loop (best-effort, se logean y se reintenta en el
  próximo tick).

## Por qué

- **Menos pasos, menos falsos no-show:** el flujo de 4 taps generaba el
  mismo problema que se quería evitar — trabajadores que sí llegaron pero
  quedaban "colgados" en un estado intermedio por olvidarse de un tap
  puramente informativo (`depart`/`start_working` no capturan geolocalización
  ni tienen efecto de negocio propio más allá de mover el estado).
- **Geolocalización pasiva descartada por límite técnico real, no por
  elección:** los navegadores no exponen tracking en segundo plano para
  PWAs/web apps. Documentar esto explícitamente evita que se vuelva a
  proponer sin evaluar el costo real (pasar a app nativa).
- **In-process, no Cron pago:** mismo criterio que ADR-0004/ADR-0007 ya
  habían fijado — no se introduce infraestructura nueva sin necesidad
  demostrada, y menos una que cuesta dinero en el plan actual.
- **Reutilizar `mark_no_show` en vez de duplicar:** el efecto de negocio de
  un no-show (reabrir el turno, penalizar reputación, notificar) es el mismo
  sea que lo dispare un comercio a mano o el scheduler — divergir esa lógica
  en dos lugares sería duplicación real, no accidental.

## Fuera de alcance (explícito)

- **Geolocalización en segundo plano / geofencing real:** requiere una app
  nativa. Si el negocio justifica esa inversión más adelante, es su propio
  ADR.
- **Configurar `CHECKIN_REMINDER_DELAY`/`NO_SHOW_GRACE_PERIOD` por comercio o
  por tipo de turno:** valores semilla globales, ajustables con datos reales
  (mismo criterio que `PUNCTUALITY_TOLERANCE`/`PAYMENT_TOLERANCE`).
- **Notificar al comercio cuando el scheduler marca no-show automático** más
  allá de lo que ya notifica `mark_no_show` (que sólo avisa al trabajador,
  igual que la versión manual de ADR-0007) — el comercio ve el turno
  reabierto en su panel; un aviso push adicional específico del disparo
  automático queda para cuando haya señal real de que hace falta.
- **Quitar los endpoints/botones legacy `depart`/`start_working`:** se
  conservan por compatibilidad con turnos ya en vuelo; removerlos del todo es
  un cambio aparte una vez que no quede ningún turno viejo en esos estados.

## Consecuencias

- ✅ El flujo de asistencia del trabajador baja de 4 pasos a 2
  (`/my-shifts`), con el recordatorio push como red de seguridad para el que
  se olvida.
- ✅ Cierra el ítem de detección automática de no-show que `TECH_DEBT.md`
  documentaba como abierto desde ADR-0007.
- ✅ `docs/TECH_DEBT.md` actualizado (cierra el ítem correspondiente).
- ⚠️ Migración `0019` agrega `shifts.checkin_reminder_sent_at` (nullable, sin
  backfill necesario).
- ⚠️ Cualquier turno creado antes de este cambio que ya estuviera en
  `EN_CAMINO`/`TRABAJANDO` sigue funcionando igual (`check_in`/`check_out`
  aceptan esos estados también) — no hace falta migrar datos existentes.
- ⚠️ El scheduler corre dentro del mismo proceso del web service: un error no
  controlado en una pasada se logea y no tira el loop, pero comparte
  recursos (conexión a la base, CPU) con el tráfico normal de la API — si el
  volumen de turnos concurrentes crece mucho, revisar si conviene separarlo
  (documentado como riesgo, no como bloqueo).

## Actualización 2026-11-18 (U080): a quien toma un turno ya empezado se lo espera desde que confirmó

Decisiones 4, 16, 18 y 19 del [tablero de la beta](../planning/BETA_TABLERO.md).
Un turno que se reabre con el horario ya empezado se reofrece
([ADR-0015](./ADR-0015-turno-no-cubierto.md), actualización del mismo día), así
que ahora alguien puede **confirmar un turno después de su `start_at`**. Todo
lo de este ADR medía desde `start_at`: a quien confirmaba a las 21:10 un turno
de las 20:00 le llegaba el recordatorio en el acto y quedaba ausente a las
22:00, con 50 minutos para llegar.

- **Referencia nueva: `Shift.expected_from`**, «desde cuándo se espera a la
  persona»: en un **turno reofrecido** (`reoffered_at`), el mayor entre
  `start_at` y `confirmed_at` (columna nueva, migración `0053`: cuándo
  confirmó quien tiene el turno ahora; se borra al reabrir). En **cualquier
  otro turno es `start_at`, aunque la persona haya confirmado después del
  inicio** (la asignaron antes de empezar o en la gracia de «no cubierto» y
  confirmó tarde): **no cambia nada** respecto de antes de U080
  (`Shift.taken_after_start`, corregido tras la revisión del mismo día). Los
  turnos confirmados antes de la migración no tienen la marca y siguen
  midiendo desde `start_at`.
- **Recordatorio de llegada:** `expected_from` + `CHECKIN_REMINDER_DELAY`
  (20 min). `checkin_reminder_sent_at` se borra al reabrir el turno, para que
  al reemplazo le llegue el suyo (antes quedaba marcado por la persona
  anterior y el reemplazo no recibía nada).
- **Ausencia automática:** `expected_from` + `NO_SHOW_GRACE_PERIOD` (2 h), sin
  tope en `end_at`: quien confirmó diez minutos antes del final no puede
  quedar ausente a los diez minutos.
- **Ausencia manual («No se presentó»):** se habilita 15 minutos después de
  `expected_from`; el mensaje dice «después de que confirmó el reemplazo». El
  panel aplica la misma regla (`puedeMarcarAusencia`,
  `frontend/lib/turno-reofrecido.ts`).
- **El recordatorio de salida no cambia** (sólo corre antes del inicio).
- **Puntualidad:** quien tomó un turno reofrecido ya empezado no tiene una hora pactada
  contra la cual medir su llegada. El turno le suma como completado y **su
  puntualidad no se mueve, ni a favor ni en contra** (`punctuality_of`,
  `shift/domain/punctuality.py`; detalle en `docs/reference/REPUTATION.md`).
  Es la opción reversible: si se decide medir «llegó hasta X minutos después
  de confirmar», se cambia en esa función. Si no llega, la ausencia sí cuenta.
- **El comercio ahora recibe un aviso cuando alguien confirmado falta** (este
  ADR lo dejaba fuera de alcance): uno solo por reapertura, que dice qué pasó
  y qué hizo la app con el turno. Textos en `docs/reference/NOTIFICATIONS.md`.

## Actualización 2026-11-18 (decisión 24): recordatorio y cierre automático

**Qué pasaba.** El scheduler cuidaba la llegada pero no el cierre. Un turno
con la salida marcada (`check_out`) que el comercio no cerraba quedaba «en
marcha» para siempre: la persona veía «Esperando que el comercio cierre el
turno», no podía calificar al comercio y el turno no le sumaba a sus
ganancias ni a su reputación.

**Decisión (Julieta, decisión 24).** Dos plazos medidos desde `check_out_at`,
junto a las otras constantes del scheduler en
`shift/application/services.py`:

- **`FINISH_REMINDER_DELAY` = 24 h — recordatorio al comercio**
  (`ShiftService.send_finish_reminder`): «Te falta cerrar un turno», con
  cuándo se cierra solo en hora argentina. Una sola vez por turno:
  `Shift.finish_reminder_sent_at` (migración `0056`) se reclama con un UPDATE
  condicional que no sube la versión (mismo patrón que el recordatorio de
  salida, ADR-0016), así que dos pasadas no mandan dos avisos. Con la cuenta
  del comercio suspendida la marca se pone igual y no se avisa nada
  (ADR-0024). El aviso dice la fecha real de la salida (la pasada puede
  llegar tarde) y tiene tipo propio, `shift_finish_reminder`, con push de
  urgencia normal: puede salir de madrugada.
- **`AUTO_FINISH_DELAY` = 72 h — cierre automático**
  (`ShiftService.auto_finish`): `CHECK_OUT → FINALIZADO`,
  `Shift.auto_finished_at` (migración `0056`), y los **mismos efectos que el
  cierre del comercio**, extraídos a un único método
  (`ShiftService._save_finished`): turno completado en la reputación de la
  persona **con la puntualidad que ya quedó registrada en la llegada** (no se
  la juzga de nuevo ni se la penaliza por la demora del comercio) y aviso
  `shift_finished` con texto propio (ya puede calificar). Al comercio le llega
  `shift_auto_finished` (le queda marcarlo como pagado), salvo cuenta
  suspendida. Si el comercio cierra en el mismo instante gana uno solo: el
  guardado con versión hace que el otro falle antes de cualquier efecto, y el
  scheduler lo saltea (`_act`).

El chequeo es `run_finish_check()` en `shift/application/scheduler.py`, con el
mismo contrato que los demás (devuelve la próxima deadline futura). No hace
falta despertar el loop al marcar la salida: el primer umbral está a un día y
el loop nunca duerme más de 6 h.

**Por qué así.** Cerrar solo es lo único que destraba a la persona sin
depender del comercio; avisar antes le da al comercio dos días para cerrarlo
él (y calificar, y registrar el pago). El pago no se toca: el turno queda
`finalizado`, y `mark_paid` y su tolerancia siguen como estaban. Cancelar no
era una salida (el turno ya se trabajó, ADR-0007 act. 2026-11-18).

**El pago tardío se avisa antes** (Julieta, 2026-11-18). Marcar pagado
después del cierre automático cuenta como pago tardío (`PAYMENT_TOLERANCE`
son 48 h desde el fin del turno y el cierre llega a las 72 h de la salida), y
así queda: un comercio que deja pasar 72 horas sin cerrar ya llegó tarde, y
no contarlo le sacaría el incentivo a cerrar a tiempo. Lo que cambia son los
avisos: el recordatorio de las 24 h dice hasta cuándo registrar el pago para
que cuente a tiempo (o que ya cuenta como tardío, si la pasada llegó tarde),
y el del cierre automático dice que cuenta como pago tardío.

**Fuera de alcance.** Plazos por comercio; avisar también a la persona a las
24 h (lo que puede hacer es escribirle al comercio por el chat). Al desplegar,
un turno que ya llevaba más de 72 h con la salida marcada se cierra en la
primera pasada sin recordatorio previo.
