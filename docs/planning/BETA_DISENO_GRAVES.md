# Salida a beta, etapa 2 — diseño de los graves que faltan

> **Para qué sirve:** que quien arregle un grupo arranque de acá y no de una
> conversación. Es el diseño (qué se cambia, dónde, qué se prueba) de los 27
> grupos que el [tablero](./BETA_TABLERO.md) tenía «sin empezar» al
> 2026-11-13. El detalle de cada hallazgo (pasos, capturas, archivo y línea)
> sigue en el tablero privado de la etapa 1. **Al mergear un grupo se borra su
> sección de acá** (queda en el historial); si al implementar el diseño
> cambia, se corrige acá en el mismo PR.

**Cómo leerlo.** Un grupo = un PR. «Quién»: **C** lo hace quien coordina
(reglas del producto, modelo de datos, sesión), **S** va en Sonnet, **M** al
subagente `mecanico`. Las decisiones que el diseño necesitaba (10 a 15 del
tablero) las tomó Julieta el 2026-11-13; su criterio: cada decisión tiene
que servir para cubrir un puesto rápido, sobre todo en los urgentes. Las rutas de frontend son relativas a `frontend/`, las de backend a
`backend/app/modules/`.

## Orden y choques

Varios grupos tocan el mismo archivo; esos van uno detrás del otro, no a la
vez. Como mucho cuatro PRs abiertos.

| Ola | Grupos | Por qué en ese orden |
|---|---|---|
| A (✅ en `main`, 2026-11-14) | G1, G7, G5, G3 | Lo que más pesa en los 10 minutos y en la confianza; no se pisan entre sí |
| B | G2, G16, G8, G9, G13, G24 | G2 después de G1 (`app/my-shifts/page.tsx`); G16 después de G7 (`next` en el ingreso) |
| C (reglas del producto, ya decididas) | G4, G6, G11, G14, G25 | G4 después de G1 y G5 (pantalla de candidatos) |
| D | G12, G15, G10, G17, G18–G23, G26, G27 | G15 después de G2 y G14 (`app/shifts/new/page.tsx`) |

Archivos con más de un grupo: `app/my-shifts/page.tsx` (G1, G2, G8, G9) ·
`app/shifts/new/page.tsx` (G2, G14, G15) · `lib/auth-context.tsx` (G7, G10,
G16) · `app/shifts/[id]/candidates/page.tsx` (G1, G4, G5, G24) ·
`shift/application/services.py` (G3, G4, G6, G25).

## Ola A

Los cuatro grupos de la ola A están en `main` desde el 2026-11-14 (G3 #562,
G5 #561, G1 #560, G7 #559).

## Ola B

### G2 · Segundo toque, segunda parte (U006, U007, U008) — S

Reusar `lib/use-tap-guard.ts`; no crear otra guarda.

- `app/shifts/new/page.tsx`: cambiar de paso pasa por la guarda, así
  «Publicar turno» no acepta el toque que venía para «Continuar».
- `components/worker/SwipeDeck.tsx`: «Postularme» pasa por la guarda (no se
  rehabilita a los 300 ms de la animación). En la grilla de
  `app/feed/page.tsx` la tarjeta postulada queda en su lugar, marcada
  «Postulado», hasta la próxima carga.
- `components/ui/Modal.tsx`: mientras el diálogo se cierra, su contenido no
  recibe toques (vale para todos los diálogos). `withdrawApplication`
  (`app/my-shifts/page.tsx`) ignora un segundo pedido en curso y no revierte
  la lista si la postulación ya estaba retirada.
- De las revisiones: los botones del trabajador que hoy ignoran el toque
  durante 1 segundo sin avisar se ven deshabilitados (`locked`).
- Pruebas: e2e de doble toque a 700 ms en los tres lugares.

### G16 · Volver a donde iba (U062) — S

`next` (validado con `lib/safe-next.ts` de G7) viaja por `/login`,
`/register`, Google y `/bienvenida`; lo pasan `components/ShiftDetail.tsx`
(«Ingresá para postularte») y `useRequireAuth`. Prueba en la app: abrir un
link de turno sin sesión, registrarse y terminar en ese turno.

### G8 · Errores de validación que se entienden (U030, U031) — S

- `lib/api.ts` (`parseErrorDetail`): leer el detalle en forma de lista y
  traducirlo por tipo («Máximo 2000 caracteres», «Tiene que ser un mail
  válido», «Entre 1 y 50»), con el nombre del campo en castellano; si no se
  reconoce, «Revisá los datos».
- Los campos llevan los mismos límites que el servidor (`maxLength`, `max`,
  `step`) en chat, publicar, perfil y registro.
- `app/my-shifts/page.tsx`: el error de «Llegué» y «Me fui» sale como aviso
  flotante, no arriba de la lista.

### G9 · Errores del turno en castellano de persona (U028, U029) — S

- `shift/domain/entities.py`: los mensajes dejan de interpolar fechas y
  duraciones crudas. Fechas en hora argentina («desde las 13:20 del
  viernes»), duraciones en palabras («2 horas»); las transiciones inválidas
  se dicen por caso («El comercio canceló este turno», «Ya lo habías
  confirmado»). El formateo vive en `core/tz.py`.
- Frontend: `act()` y `run()` recargan la lista también cuando fallan.
- Pruebas: tests del dominio por mensaje (ninguno contiene `T` de fecha ni
  `→`).

### G24 · Tarjetas que se salen de la pantalla (U026, U075, U124) — M

`min-w-0` (y `grid-cols-1` donde falta) en
`app/shifts/[id]/candidates/page.tsx`, `components/CandidateCard.tsx`,
`app/chats/layout.tsx`, `app/admin/en-vivo/page.tsx` y
`app/admin/support/page.tsx`. Capturas a 390 px con un nombre de 60 letras,
en claro y oscuro. La lista de postulantes de
`app/shifts/[id]/candidates/page.tsx` ya no se sale con un nombre largo
(`min-w-0`, #561): ahí falta sólo verificarlo.

## Ola C

### G4 · La lista de postulantes dice quién sigue (U021, U123) — C

- Quien retiró su postulación no aparece
  (`application/infrastructure/repositories.py`, `list_by_shift_enriched`).
- Hoy, cuando alguien rechaza, cancela o falta, su postulación queda
  «aceptada»: nada lo registra. Estado nuevo `desasignada` con su motivo
  (`rechazo`, `cancelacion`, `ausencia`) en `application/domain/`; lo marcan
  `reject_assignment`, `worker_cancel` y `mark_no_show` por el puerto que ya
  usan. Migración Alembic (columna `motivo`), registrar en
  `tests/conftest.py`.
- En la pantalla, esas personas van al final, con su marca («Rechazó este
  turno», «Canceló», «No se presentó»), y se pueden volver a asignar.
- Antes de escribir: confirmar qué hace `ApplicationService.apply` con una
  postulación `aceptada` de un turno reabierto, y dejarlo coherente con
  `lib/applications.ts`.
- U123: al confirmar un turno, la app retira las otras postulaciones del
  mismo horario; se suma un solo aviso al trabajador que dice cuáles y por
  qué, y que puede volver a postularse si el turno confirmado se cae.
- Actualizar `docs/foundation/DOMAIN.md` y `NOTIFICATIONS.md`.

### G6 · Cuentas suspendidas (U023, U097, U095) — C

- Asignar: `assign_worker` rechaza a una persona con la cuenta no activa,
  antes de rechazar a los demás postulantes; la lista de postulantes no la
  muestra (mismo criterio que «Recomendados»).
- Ingreso: el 403 lleva un código (`account_suspended`: el frontend ya lo
  espera desde G7, en el ingreso y en la renovación, `lib/api.ts`
  `ACCOUNT_SUSPENDED_CODE`); con la contraseña bien puesta dice «Tu
  cuenta está suspendida. Si creés que es un error, escribinos a
  hola@oido.com.ar». No se muestra el motivo que escribió el admin.
- Comercio suspendido (decisión 10): sus turnos abiertos salen de
  Inicio, Buscar, el Mapa y la página pública y no aceptan postulaciones; los
  que tienen a alguien asignado o confirmado y no empezaron se cancelan con
  aviso a esa persona, sin penalidad para nadie; el admin ve antes de
  suspender cuántos turnos toca. Simétrico al suspender a un trabajador con
  turnos confirmados: el turno se reabre y se le avisa al comercio.
- ADR nuevo (efectos de una suspensión) antes del código.

### G11 · «Mi plan» durante la beta (U093, BK-898A15047291) — S

- El servidor ya sabe si el tope se exige; `/subscription` lo expone y
  `components/subscription/SubscriptionStatusCard.tsx` lo respeta: sin tope
  exigido, muestra el uso sin alarma, una línea «Durante la beta no hay tope
  de turnos», y no muestra «Alcanzaste el límite» ni la oferta de cambio.
- «Pagado hasta» se vuelve a pedir al volver a la pestaña (`useLiveRefresh`
  de G1).

### G14 · Fechas y duración del turno (U055, U056, U060) — C

- Dominio (`shift/domain/entities.py`) y formulario con la misma regla: el
  inicio no puede haber pasado (tolerancia de 5 minutos) y la duración va
  entre el mínimo y el máximo que se decidan; mensaje al lado del campo.
- Fin anterior al inicio con la misma fecha: se toma como el día siguiente y
  se dice («Termina el sábado a las 02:00», `components/ShiftDayHint.tsx`);
  «Continuar» nunca queda gris sin explicación.
- El resumen del último paso muestra siempre fecha y horario, también en
  celular. Duplicar un turno abre en el paso de la fecha, no en el último.

### G25 · El evento cuenta y avisa bien (U083, U086) — C

- `app/shifts/page.tsx`: el total no cuenta cancelados; «cubiertos» son los
  confirmados en adelante.
- `shift/application/services.py`: un solo aviso por evento y por persona
  («Evento X: 5 puestos cerca tuyo»), y no se le avisa a quien ya está
  confirmado en un puesto de ese evento que se pisa de horario.

## Ola D

### G12 · El alta que quedó a medias (U034, U035) — S

- Al ingresar, si la cuenta no tiene perfil de su rol, va a `/bienvenida`.
  Panel e Inicio muestran «Te falta completar tu comercio / tu perfil» con su
  botón en vez del error genérico.
- Trabajador sin zona u oficio: cartel fijo en Inicio («Completá tu zona y
  tus oficios para recibir turnos») hasta que lo complete. Cubre también la
  decisión 9 (los dos trabajadores sin zona).
- De las revisiones: reentrar a la bienvenida del comercio y «Omitir por
  ahora» no pisa el perfil que ya existe.

### G15 · El asistente de publicar no pierde lo cargado (U057, U135, BK-7DCC4AB945) — S

- La respuesta de la IA completa sólo los campos que la persona no tocó, y no
  salta de paso si ya avanzó.
- El paso va en la dirección (`?paso=`): «Atrás» vuelve al paso anterior. El
  borrador y su clave para no repetir el pedido se guardan en
  `sessionStorage` (se borran al publicar y al cerrar sesión). Lo mismo para
  los pasos de `/bienvenida`.

### G10 · Límite de intentos sin mensajes falsos (U138, U139) — S

- `lib/auth-context.tsx`, `app/register/page.tsx`: si el alta salió bien y el
  ingreso automático fue frenado, va a `/login` con «Tu cuenta ya está
  creada: ingresá en un minuto», sin cartel de error.
- `app/recuperar/page.tsx`, `app/verificar-email/page.tsx`: un 429 dice
  «Demasiados intentos, esperá un minuto»; lo demás sigue sin revelar si el
  mail existe.

### G17 · El interruptor de avisos explica (U054) — S

`components/PushToggle.tsx`: bloqueado en el navegador → cómo activarlo; sin
soporte (iPhone sin instalar) → «Instalá la app para recibir avisos»; falla →
aviso flotante.

### G18 · En compu también se llega al detalle y a Buscar (U064, U104) — S

`components/worker/OpportunityCard.tsx` abre `/turno/[id]` en la grilla de
escritorio, en `/buscar` y en `/map`; «Buscar» entra al menú de
`components/Navbar.tsx` del trabajador.

### G19 · Las tarjetas dicen quién y cuántos (U065, U024, U025) — S

- `GET /applications/mine` trae el nombre del comercio (por el mismo camino
  que `/shifts/mine`).
- `lib/shift-next-step.ts`: «Asignado a Ana», «Beto confirmó», «Beto llegó»
  (el nombre ya viaja).
- `/shifts/me` suma la cantidad de postulaciones pendientes (una sola
  consulta agrupada) y el botón dice «Elegir a alguien (2)».

### G20–G23 · Descubrir y mapas (U069, U105, U071, U073) — S, un PR cada uno

- G20 `components/worker/SwipeDeck.tsx`: el toque abre el detalle sólo si no
  hubo arrastre.
- G21 `app/map/page.tsx`, `components/worker/MapSheet.tsx`: la cámara deja
  libre el alto de la hoja.
- G22 `components/map/MapView.tsx`, `components/employer/EnRouteMap.tsx`: el
  encuadre sigue a los dos puntos en cada actualización.
- G23 `app/search/page.tsx`: parte del local (`lib/company-place.ts`) y lo
  dice («Desde tu local»).

### G26 · La portada del admin cuenta lo de hoy (U125, U126, U127) — S

`shift/infrastructure/repositories.py`: «urgentes sin cubrir» filtra por el
día argentino. «Ausencias de hoy» lleva a su lista
(`/admin/en-vivo?filtro=ausencias`). El buscador de Personas encuentra por
nombre del local.

### G27 · Tickets que se pueden reabrir (U128) — S

`support/application/services.py`: un mensaje del admin en un ticket cerrado
lo reabre y la persona puede contestar; el admin tiene «Reabrir». La persona
sigue sin poder reabrirlo por su cuenta (decisión 12).
