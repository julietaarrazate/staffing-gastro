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
