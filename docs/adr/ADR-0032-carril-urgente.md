# ADR-0032 — Carril urgente: «Puedo ir ya» y confirmación directa (P4)

**Estado:** aceptado (Julieta, 2026-11-27), detrás de `URGENTE_DIRECTO`
(apagado) · **Fecha:** 2026-11-27 ·
**Origen:** mejora P4 del [tablero de la beta](../planning/BETA_TABLERO.md) y
[`PROPUESTA_URGENTE_Y_PROGRAMADO.md`](../planning/PROPUESTA_URGENTE_Y_PROGRAMADO.md) §2.
Completa el [ADR-0031](./ADR-0031-orden-de-postulantes-y-reconfirmacion.md).

## Contexto

En un turno que empieza en pocas horas, la espera más cara es la de
«confirmá tu asistencia»: el comercio elige a alguien y el turno queda
«asignado» hasta que esa persona abre la app y confirma. La propuesta original
(§2) era «gana el primero que toca, sin que el comercio elija».

## Decisión

1. **Ventana.** Un turno que empieza en **menos de 6 horas** es del carril
   urgente (la misma ventana de «Urgentes» del Inicio y del ADR-0031).
2. **Postularse compromete.** En ese carril el botón dice **«Puedo ir ya»** y
   antes de postular se le pregunta: «¿Podés ir a este turno? Empieza <día y
   hora>. Si el comercio te acepta, el turno queda confirmado en el momento:
   no vas a tener que confirmar de nuevo.» (`ShiftResponse.apply_commits` se lo
   dice a cada pantalla).
3. **Aceptar confirma.** Cuando el comercio acepta a quien se ofreció para ya,
   el turno pasa **directo a `confirmado`**: se saltea `asignado`. Valen las
   mismas guardas que al confirmar (agenda serializada y regla de doble turno):
   si la persona quedó comprometida en otro turno que se pisa, el comercio
   recibe un 409 y la lista se recarga. La persona recibe «¡Te aceptaron! El
   turno es tuyo».
4. **El comercio ve quién se ofreció.** `ApplicantResponse.se_ofrecio_para_ya`
   marca a esas personas («Puede ir ya») y su botón dice «Aceptar».
5. **El reconocimiento se guarda, no se deduce de la fecha.** Al postularse,
   la pantalla manda `{"puedo_ir_ya": true}` si la persona tocó «Sí, puedo
   ir». El servidor guarda en la postulación `se_ofrecio_para_ya` = regla
   prendida **y** `puedo_ir_ya` **y** el turno empieza en menos de 6 horas
   *en ese momento*. Lo demás lee sólo esa columna: aceptar (confirma directo
   sólo si es verdadera), «Puede ir ya» del comercio y «Te ofreciste…» de la
   persona. Una primera versión lo calculaba después con `created_at`; no
   alcanzaba, porque el servidor decidía por una fecha y no por lo que la
   persona vio: una pantalla cargada con «Postularme» antes de las 6 horas
   quedaba «ofrecida» sin haber leído la pregunta. Casos:
   - **Pantalla vieja** (regla prendida, turno dentro de la ventana, sin
     `puedo_ir_ya`): 409 `puedo_ir_ya_requerido` («Este turno empieza pronto:
     confirmá que podés ir.») y no se crea la postulación; la pantalla abre
     la pregunta y reintenta.
   - **Reconoció pero el turno no estaba en la ventana:** se crea normal, con
     `se_ofrecio_para_ya = false`.
   - **Postulación hecha con la regla apagada** y aceptada con la regla
     prendida: queda «asignado» y confirma como siempre.
   - **Volver a postularse** (`reapply`) recalcula el campo con el pedido
     nuevo; retirar lo borra.
   - **Si el comercio cambia el horario**, todas las postulaciones del turno
     vuelven a `false`: la persona dijo que sí a otro horario (el aviso
     «cambió un turno al que te postulaste» ya existe).
   - **Consecuencia dicha de frente:** la pregunta cierra con «Si después no
     podés ir, cuenta como una cancelación», y el mail de un turno confirmado
     directo dice lo mismo (con menos de 24 horas no hay aviso sin peso).
6. **Detrás de `URGENTE_DIRECTO`, apagado por defecto.** Con la regla apagada
   nada cambia: `apply_commits` y `se_ofrecio_para_ya` salen en `false`. Se
   prende en producción una vez que los Términos lo dicen (frase agregada el 2026-11-28, versión
   legal `2026-11-28-1`).

   **Apagar y volver a prender.** Con la regla apagada la columna se guarda en
   falso (hay un test que lee la base), pero las marcas hechas antes de
   apagarla siguen ahí. Si se apaga y se vuelve a prender en menos de un día
   hay que limpiarlas antes con `UPDATE shift_applications SET
   se_ofrecio_para_ya = false`; pasado un día no hace falta, porque los
   turnos de esas postulaciones (menos de 6 horas al postular) ya empezaron.
   Está en el runbook de `reference/DEPLOY.md`. No se resuelve con código a
   propósito: es una operación rara y de una sola vez.
7. **El compromiso sólo vale mientras la postulación está pendiente.**
   Rechazar, soltar, restaurar o desasignar lo borran: si A se ofrece, el
   comercio acepta a B, B cancela y se reabre el turno, aceptar a A lo deja
   «asignado» y A confirma. Y también se borra si el comercio cambia el
   horario, baja el pago o cambia el lugar del turno (los tres definen lo
   que la persona aceptó).
8. **El 409 `puedo_ir_ya_requerido`** trae un mensaje legible para clientes
   viejos sin el diálogo («Cerrá la app y volvé a abrirla para poder
   postularte.»); el cliente nuevo no lo muestra, abre la pregunta por el
   `code`. Quien ya está postulado recibe «Ya te postulaste» antes que la
   pregunta, y la respuesta del `POST` trae el `se_ofrecio_para_ya` que
   guardó el servidor, que es el que dice «Te ofreciste…».

## Qué se descartó

**«Gana el primero que toca, sin que el comercio elija»** (propuesta original).
Se descartó porque **siempre aceptan las dos partes**: la persona al ofrecerse
y el comercio al aceptarla. Que el comercio no pudiera elegir le sacaría
control sobre quién entra a su local (y los filtros, la verificación y el
orden del ADR-0031 dejarían de importar). Lo que se ahorra es sólo la segunda
confirmación de la persona, que en un urgente es la más cara.

## Qué no cambia

- Quién acepta: siempre el comercio. Nadie queda asignada sin su acción.
- Las penalidades de cancelación y ausencia (ADR-0004 y ADR-0007) y la
  reconfirmación del ADR-0031, que sólo corre en turnos confirmados con
  anticipación.
- Quién ve qué: `se_ofrecio_para_ya` se deduce de la postulación, que el
  comercio ya ve.

## Consecuencias

- Quien toca «Puedo ir ya» asume un compromiso: la pregunta lo dice antes y
  «Ahora no» no manda nada.
- Hay una columna nueva (`shift_applications.se_ofrecio_para_ya`, migración
  0067, NOT NULL, falso para lo que ya existía).
- Al aceptar a quien se ofreció, el mail de aceptación sale en su variante
  «ya quedó confirmado» (no pide confirmar).
- Un turno puede pasar de «publicado» a «confirmado» en un solo paso del
  comercio; los avisos y el scheduler ya tratan al confirmado.
