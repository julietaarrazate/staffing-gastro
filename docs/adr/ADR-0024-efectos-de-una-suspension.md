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
   cuenta se reactiva y el turno sigue vigente, vuelve a verse.
2. **Los turnos con alguien asignado o confirmado que todavía no empezaron se
   cancelan**, con aviso a esa persona. La cancelación **no cuenta como
   tardía ni penaliza a nadie**: no la decidió el comercio ni el trabajador.
3. **Los que ya empezaron no se tocan** (llegada marcada, trabajando o con la
   salida marcada): el trabajo ya está ocurriendo; se termina y se paga como
   siempre, y un problema va por soporte.
4. **La admin ve antes de confirmar la suspensión cuántos turnos toca** (cuántos
   se ocultan y cuántos se cancelan con aviso).

### Trabajador suspendido

5. **Sus turnos asignados o confirmados que no empezaron se reabren** y se le
   avisa al comercio, igual que cuando alguien cancela su asignación: vuelven
   a «Buscando personal» y los demás postulantes vuelven a estar disponibles.
   Por simetría con el punto 2, **no se le suma una cancelación** a la
   reputación del trabajador: la medida es la suspensión, no la cancelación.
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
9. **Reactivar** devuelve la cuenta a como estaba: lo oculto vuelve a verse si
   sigue vigente; lo cancelado o reabierto no se deshace.

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
