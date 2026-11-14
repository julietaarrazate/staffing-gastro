# Errores del turno en castellano de persona (G9, U028 y U029) (#569)

**Pedido:** salida a beta (G9). Los errores del turno decían «el turno empieza el 2026-11-13T16:…» (ISO, en UTC, tres horas corrida) y, en las transiciones inválidas, nombres de estados internos con flechas.

**Qué cambió:** ningún mensaje del módulo de turnos interpola ya fechas ni duraciones crudas, ni nombres de estados, ni `→`.

- `backend/app/core/tz.py`: `format_duracion` («2 horas», «45 minutos», «1 hora y 30 minutos») y `format_desde_art` («desde las 13:20 de hoy / de mañana / del viernes», con fecha si falta una semana o más), siempre en hora argentina. Con tests, incluida la medianoche y un turno que cruza al día siguiente.
- `backend/app/modules/shift/domain/mensajes.py` (nuevo): el texto de cada acción según en qué punto está el turno (`no_se_puede(accion, estado)`). Sólo textos; cuándo se permite cada transición no cambió.
- `backend/app/modules/shift/domain/entities.py`: usa lo anterior; `_transition` recibe el nombre de la acción.
- `frontend/app/my-shifts/page.tsx` (`act`) y `frontend/app/shifts/page.tsx` (`run`): al fallar una acción recargan la lista (silenciosa, respeta «último pedido gana» y `paused` de `useLiveRefresh`), para no seguir mostrando un botón que ya no corresponde.

**Mensajes, antes → después**

| Caso | Antes | Después |
|---|---|---|
| Llegada antes de hora | El turno empieza el 2026-11-13T16:20:00+00:00. | Todavía no podés marcar tu llegada: se habilita desde las 13:20 del viernes (30 minutos antes de que empiece el turno). |
| Ausencia antes de hora | …se habilita el 13/11 a las 20:15 (hora de Argentina), 15 minutos después del inicio. | …se habilita desde las 20:15 de hoy, 15 minutos después de que empieza el turno. |
| Ubicación de camino antes de hora | …recién desde 2:00:00 antes del inicio. | Todavía falta para el turno: podés compartir tu ubicación desde las 18:00 de hoy (2 horas antes de que empiece). |
| Ubicación de camino, mal estado | …a un turno confirmado, no en estado asignado | Por caso: «Primero tenés que confirmar el turno para compartir tu ubicación.», etc. |
| Lejos del local | …(estás a 450 m). | …(estás a 450 metros). |
| Salida antes de hora | Ya estaba en castellano (sin cambio). | Sin cambio. |
| Doble turno | Ya estaba en castellano (sin cambio). | Sin cambio. |
| Editar fuera de borrador/publicado | (código interno del estado; la API ya lo reemplazaba) | Este turno ya no se puede editar. |
| Transición inválida, en general | Transición inválida: confirmado → asignado | Por acción y estado, ver abajo. |
| Confirmar, ya confirmado | idem | Ya habías confirmado este turno. |
| Confirmar / rechazar / cancelar asistencia / llegada / salida, comercio canceló | No se puede … desde el estado cancelado | El comercio canceló este turno. |
| Rechazar, ya confirmado | No se puede rechazar un turno en estado confirmado | Ya habías confirmado este turno. Si no podés ir, cancelá tu asignación. |
| Cancelar asistencia, sin confirmar | No se puede cancelar la asignación desde el estado asignado | Todavía no confirmaste este turno: si no podés ir, rechazalo. |
| Cancelar asistencia, ya llegó | idem | Ya marcaste tu llegada: este turno ya no se puede cancelar. |
| Cancelar (comercio), ya cancelado | No se puede cancelar un turno en estado cancelado | Ya cancelaste este turno. |
| Cancelar (comercio), ya trabajado | …en estado finalizado | Este turno ya se trabajó, no se puede cancelar. |
| Asignar, ya hay alguien | No se puede asignar un turno en estado asignado | Este turno ya tiene a alguien asignado. (confirmado: «…a alguien confirmado.») |
| Asignar, borrador | …en estado borrador | Publicá el turno antes de elegir a alguien. |
| Publicar, ya publicado | Transición inválida: publicado → publicado | Este turno ya está publicado. |
| No se presentó, sin nadie | No se puede marcar no-show desde el estado buscando_personal | Este turno no tiene a nadie asignado. |
| No se presentó, ya llegó | idem, check_in | El trabajador ya marcó su llegada. |
| Llegada, sin confirmar | No se puede marcar llegada desde el estado asignado | Primero tenés que confirmar el turno. |
| Llegada, ya marcada | idem | Ya marcaste tu llegada. |
| Salida, sin llegada | No se puede marcar salida desde el estado confirmado | Primero tenés que marcar tu llegada. |
| Salida, ya marcada | idem | Ya marcaste tu salida. |
| Cerrar (comercio), falta la salida | Transición inválida: check_in → finalizado | El trabajador todavía no marcó su salida. |
| Cerrar, ya cerrado | …finalizado → finalizado | Este turno ya estaba cerrado. |
| Pagado, sin cerrar | Transición inválida: check_out → pagado | Primero tenés que cerrar el turno. |
| Pagado, ya pagado | …pagado → pagado | Ya marcaste este turno como pagado. |
| Resto de combinaciones (salir, empezar, no cubierto, etc.) | Nombres de estado y flecha | Un texto por estado en `mensajes.py`; la red de seguridad es «Esta acción ya no se puede hacer: el turno cambió. Actualizá la pantalla.» |

**Por qué así:** los textos viven en un módulo de dominio sin imports de afuera y el formateo de horas en `core/tz.py`, que ya concentra la hora argentina. Un test recorre todas las acciones por todos los estados y exige que ningún mensaje tenga fecha ISO, `→`, identificador de estado, ni el genérico en los casos que se pueden alcanzar. No se tocó ninguna regla: márgenes de tiempo, quién puede qué y qué estados permite cada acción son los de antes.

**Queda abierto:** nada de G9. Los mensajes del módulo de turnos que vienen de otros lados (planes, postulaciones) no estaban en el alcance.
