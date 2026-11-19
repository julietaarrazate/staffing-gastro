# ADR-0024 — Qué pasa con los turnos cuando se suspende una cuenta

**Estado:** aceptado · **Fecha:** 2026-11-14 · **Decisiones de Julieta:** 10 y 12 del
[tablero de la beta](../planning/BETA_TABLERO.md) (2026-11-13)

## Contexto

La admin puede suspender una cuenta desde su ficha (`AdminService.suspend_user`).
Hasta hoy la suspensión sólo cambiaba el estado del usuario: el ingreso y la
renovación de la sesión daban 403, y `matching` ya dejaba fuera de
«Recomendados» a las cuentas que no están activas. Todo lo demás seguía
como si nada (hallazgos U023, U097 y U095 de la prueba de punta a punta):

- un comercio podía **asignar** a una persona suspendida: el turno quedaba
  «Esperando que confirme» para siempre, porque esa persona ya no puede
  entrar a confirmarlo;
- los turnos de un **comercio suspendido** seguían a la vista y aceptando
  postulaciones, y los que ya tenían a alguien quedaban colgados;
- un **trabajador suspendido** seguía confirmado en sus turnos: el comercio
  lo esperaba y nadie le avisaba;
- al ingresar, la persona suspendida veía un error genérico.

La meta de la beta es cubrir un puesto rápido. Un turno colgado de una
cuenta que no puede actuar es el peor caso: nadie lo cubre y nadie se entera.

## Decisión

### Comercio suspendido

1. **Sus turnos abiertos dejan de verse y de aceptar postulaciones.** Salen del
   Inicio, Buscar, el Mapa y la página pública del turno (que responde como
   un turno que ya no está disponible). No se cancelan ni se borran: si la
   cuenta se reactiva y el turno sigue vigente, vuelve a verse. Tampoco
   aparecen en «Guardados» ni se pueden guardar.
2. **Los turnos con alguien asignado o confirmado que todavía no empezaron se
   cancelan**, con aviso a esa persona. La cancelación **no cuenta como
   tardía ni penaliza a nadie**: no la decidió el comercio ni el trabajador.
3. **Los que ya empezaron no se tocan** (llegada marcada, trabajando o con la
   salida marcada, o con la hora de inicio ya pasada aunque nadie haya
   marcado la llegada: puede haber alguien trabajando; siguen su curso, con
   la llegada o la ausencia automática): el trabajo ya está ocurriendo; se termina y se paga como
   siempre, y un problema va por soporte.
4. **La admin ve antes de confirmar la suspensión cuántos turnos toca** (cuántos
   se ocultan y cuántos se cancelan con aviso).

### Trabajador suspendido

5. **Sus turnos asignados o confirmados que no empezaron se reabren** y se le
   avisa al comercio, igual que cuando alguien cancela su asignación: vuelven
   a «Buscando personal» y los demás postulantes vuelven a estar disponibles.
   Por simetría con el punto 2, **no se le suma una cancelación** a la
   reputación del trabajador: la medida es la suspensión, no la cancelación.
   Tampoco queda marcado en la lista de postulantes: su postulación vuelve a
   `pendiente`, no a `desasignada`
   ([ADR-0026](./ADR-0026-postulacion-desasignada.md), punto 7).
6. **No se lo puede asignar**: `assign_worker` lo rechaza antes de tocar a los
   demás postulantes, y la lista de postulantes no lo muestra (el mismo
   criterio que ya usaba «Recomendados»).
7. Los turnos que ya empezaron no se tocan (punto 3).

### Para las dos

8. **Al ingresar** con la contraseña correcta, el 403 lleva el código
   `account_suspended` y la app dice «Tu cuenta está suspendida. Si creés que
   es un error, escribinos a hola@oido.com.ar». **No se muestra el motivo**
   que escribió la admin. La renovación de una sesión abierta responde lo
   mismo, y la app lleva al ingreso con ese texto (`lib/api.ts`,
   `ACCOUNT_SUSPENDED_CODE`, desde #559).
9. **Dos pasadas.** Los efectos se aplican antes de marcar la cuenta (si
   fallan, la cuenta queda activa y la admin repite) y otra vez después de
   marcarla y revocar sus sesiones: mientras corría la primera la cuenta
   seguía activa y alguien pudo asignar un turno. Son idempotentes.
10. **Reactivar** devuelve la cuenta a como estaba: lo oculto vuelve a verse si
   sigue vigente; lo cancelado o reabierto no se deshace.

11. **No se le puede escribir por chat a una cuenta suspendida.** Un mensaje
    nuevo se rechaza como un chat ajeno (404, sin decir «suspendida»); leer lo
    ya escrito sigue permitido.

## Consecuencias

- La suspensión pasa a tener efectos sobre turnos ajenos (los de quien había
  confirmado o el comercio que esperaba): por eso cada efecto lleva su aviso.
- `assign_worker` consulta si la cuenta del trabajador está activa; el feed,
  la búsqueda, el mapa, la escalada de urgencia, la página pública y las
  postulaciones, si lo está la del comercio. El cruce entre módulos va por
  puerto inyectado, como el resto (la administración pide los efectos por
  `AccountSuspensionEffects`, que implementa el caso de uso de turnos).
- Los avisos nuevos se suman a `docs/reference/NOTIFICATIONS.md`.

## Descartado

- **Cancelar también los turnos abiertos del comercio suspendido:** se pierde
  el turno si la suspensión fue un error y se reactiva enseguida. Ocultarlo
  alcanza para que nadie se postule.
- **Penalizar al trabajador suspendido como si hubiera cancelado:** mezcla dos
  medidas sobre el mismo hecho y le ensucia la reputación a alguien que
  quizás vuelve.
- **Mostrar el motivo de la suspensión al ingresar:** lo escribe la admin
  para su propio registro y puede incluir datos de terceros.

## Actualización 2026-11-18 (segunda mirada)

Seis arreglos de una auditoría de esta misma decisión; ninguno cambia lo decidido arriba.

1. **Reabrir a medias:** si falla la cola de reabrir un turno (restaurar rechazados, soltar la postulación), se registra y no impide el aviso al comercio; `apply_account_suspension` repasa las postulaciones aceptadas de un turno ya abierto y sin esa persona y repite la cola, así que repetir la suspensión ya no deja rechazados para siempre.
2. **`assign_worker`:** primero valida que el turno admita la asignación (`Shift.admits_assignment`) y recién después mira la cuenta: ya no sirve para saber si alguien está suspendido.
3. **Chat:** no se le puede escribir a una cuenta suspendida (11 más arriba); se responde como un chat ajeno.
4. **Avisos:** al suspender se cortan los WebSockets de avisos de esa cuenta (puerto `LiveConnectionCloser` del admin) y no se le manda push; el aviso in-app se sigue guardando.
5. **«Mis postulaciones»:** las del turno de un comercio suspendido vienen con `shift: null` (salvo el turno asignado a la misma persona); el estado de la postulación no cambia.
6. **Asistente de IA:** `find_applicant_by_name` excluye cuentas suspendidas, como la lista de postulantes.

## Actualización 2026-11-18 (dispositivos)

Al suspender una cuenta se borran todos sus dispositivos registrados para los avisos push (sus filas de `push_subscriptions`), por el puerto `AccountDeviceRemover` del admin. Va después de marcar la cuenta y es best-effort, como el corte de sockets: si falla se registra y la suspensión queda hecha (a una cuenta suspendida igual no se le manda push, y el barrido de dispositivos de cuentas con las sesiones revocadas los levanta después: suspender las revoca todas). Reactivar no restaura nada: cada dispositivo se vuelve a registrar solo en el próximo ingreso. Detalle en `docs/reference/ACCESO_MODERNO.md` → «Baja del dispositivo».

## Actualización 2026-11-18 (decisión 22): los turnos ocultos vencen

El punto 1 no decía qué pasa cuando al turno oculto se le pasa el horario. Decisión 22 de Julieta:

1. **Vence igual.** El chequeo de cobertura ([ADR-0015](./ADR-0015-turno-no-cubierto.md)) no mira la cuenta: pasada la gracia, el turno abierto (o asignado sin confirmar que la suspensión no tocó, punto 3) queda en «no cubierto».
2. **Sin aviso a la cuenta suspendida:** ni en la app, ni push, ni mail (`ShiftService.mark_not_covered`). Con la cuenta activa, todo como antes.
3. **Fuera de las métricas de cobertura,** del numerador y del denominador: estaba oculto, nadie pudo postularse, no dice nada de la promesa de los 10 minutos. Quedan fuera de los publicados, cubiertos, cumplidos, tiempos y tasas del período (`count_period_stats`), de las tasas de asignación y de finalización (`count_publication_stats`) y de la muestra del tiempo hasta cubrir (`list_recently_filled`). No cambian los conteos que no miden cobertura: «Locales activos» (el comercio publicó), ausencias, postulaciones, usuarios y «comercios que vuelven a publicar».
4. **La marca va en el turno** (`shifts.not_covered_while_suspended`, migración 0055; la pone `Shift.mark_not_covered(company_suspended=True)`), no se mira el estado de la cuenta al calcular: la cuenta puede reactivarse después y el turno no tiene que volver a contar.
5. **Reactivar no deshace nada** (punto 10): el comercio ve esos turnos como «No cubierto» en su panel, sin aviso, y siguen fuera de las métricas.

No cambia qué muestran «Hoy» y «Turnos en vivo» del admin sobre los turnos ocultos que todavía no vencieron.

6. **Con U080:** si quien tenía un turno empezado de un comercio suspendido lo deja (ausencia automática, cancelación, rechazo), el turno queda reofrecido pero oculto: no sale el aviso urgente a quienes están cerca ni el aviso al comercio (`ShiftService._announce_reopen`). Cuando vence, entra por el punto 1, con la marca. Si al reabrirse ya no le quedaba horario y pasa directo a «no cubierto», no lleva la marca (caso raro: un comercio suspendido con un turno empezado que alguien deja con menos de 2 h 15 min por delante).

## Actualización 2026-11-18 (decisión 21): cerrar un turno empezado de una cuenta suspendida

El punto 3 deja los turnos ya empezados como estaban, pero la parte suspendida
ya no puede entrar: si es el trabajador, nadie marca la salida; si es el
comercio, nadie cierra el turno. El turno quedaba a medias para siempre.

**Decisión de Julieta:** una acción de la admin, **«Cerrar turno»**, que hace
el paso que falta **en nombre de la parte suspendida**, con registro.

12. **Sólo en nombre de la parte suspendida y sólo en un turno empezado**
    (llegada marcada en adelante; la regla es `Shift.admin_close_plan`):
    - **Trabajador suspendido**, turno con la llegada marcada (`check_in` o
      `trabajando`): la admin marca la salida, sin ubicación y con la hora de
      ahora (`Shift.admin_check_out`: sin el control de distancia, pero no
      antes del inicio, como `check_out`). Después el comercio, activo,
      cierra como siempre.
    - **Comercio suspendido**, turno con la salida marcada: la admin lo
      cierra, con los mismos efectos que el cierre del comercio
      (`ShiftService._save_finished`: reputación del trabajador con la
      puntualidad registrada y aviso para calificar).
    - **Las dos suspendidas**, llegada marcada: marca la salida y cierra en
      la misma acción (un solo guardado).
    - En cualquier otro caso (ninguna suspendida, turno no empezado o ya
      terminado, o el paso que falta le toca a la parte activa): 409 con el
      motivo para la admin (`shift/domain/mensajes.py`). Turno inexistente: 404.
    - **No marca pagado:** eso es del comercio; un comercio suspendido lo
      resuelve por soporte.
13. **Registro:** `shifts.closed_by_admin_at` y `closed_by_admin_user_id`
    (migración 0058), más el log de negocio `admin close_shift` con la admin,
    el turno y qué hizo.
14. **Push sólo a la parte activa** (a la suspendida, el aviso queda guardado en la app). Trabajador suspendido: al comercio,
    que Oído marcó la salida de esa persona (a qué hora) porque no
    pudo marcarla, y que ya puede cerrar (`shift_checked_out`, abre
    `/shifts`). Como el resto de los avisos de este ADR, no dice que la
    cuenta está suspendida. Comercio suspendido: al trabajador, el aviso de
    cierre de siempre (`shift_finished`). A la cuenta suspendida no le llega
    nada al celular, como a toda cuenta suspendida (punto 4 de la
    actualización anterior): el aviso que le toque queda guardado en la app.
15. **Concurrencia:** bloqueo optimista como el resto (ADR-0016). Si el
    trabajador o el comercio actuó en el medio, 409 «El turno cambió mientras
    tanto», sin registro ni avisos. Además, el pedido lleva lo que la admin
    vio y confirmó en el diálogo (`check_out`, `finish`): si ahora se haría
    otra cosa (por ejemplo, se suspendió también la otra cuenta), 409 «El
    turno cambió: volvé a abrir la ficha.» sin tocar nada, y la ficha se
    recarga. Nunca se ejecuta más de lo confirmado.
16. **Dónde:** `POST /api/v1/admin/shifts/{id}/close` (sólo admin, con la
    verificación en dos pasos). La ficha de la persona suspendida
    (`/admin/personas/[id]`) muestra «Cerrar turno» en cada turno donde
    aplica: además de los recientes, trae sin límite sus turnos empezados
    (llegada o salida marcada), y `admin_close` por turno (qué haría y a
    quién avisa), calculado en el backend con la misma regla y sólo donde la
    persona es parte (el trabajador asignado ahora o el comercio dueño).
    El diálogo dice qué va a pasar antes de confirmar y el resultado al
    terminar. El módulo `admin` lo pide por el puerto
    `SuspendedAccountShiftCloser` (`shift/domain/suspension.py`), que
    implementa `ShiftService`.

**Descartado:** cerrar solo, sin la admin, al suspender (el turno puede seguir
trabajándose mientras tanto: la salida tiene que ser la hora real, y la marca
quien mira el caso); y marcar pagado (el pago pasa fuera de la app y lo
declara el comercio).

