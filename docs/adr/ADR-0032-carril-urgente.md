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
5. **Se mide contra el momento de la postulación**, no contra el de la
   asignación. Quien se postuló con días de anticipación vio «Postularme», no
   «Puedo ir ya»: nadie le prometió que aceptar la confirmaba, así que se le
   sigue pidiendo que confirme aunque el comercio la acepte a 3 horas del
   turno. Tampoco cuenta quien el comercio elige desde «Recomendados» sin que
   se haya postulado, ni quien vuelve a ser elegida después de dejar el turno:
   sólo una postulación vigente (pendiente) hecha dentro de la ventana.
6. **Detrás de `URGENTE_DIRECTO`, apagado por defecto.** Con la regla apagada
   nada cambia: `apply_commits` y `se_ofrecio_para_ya` salen en `false`. Se
   prende en producción cuando los Términos digan que quien se ofrece para ya
   queda confirmada al ser aceptada (cambia `/terminos`, sube
   `LEGAL_TERMS_VERSION`, con el sí de Julieta).

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
- Un turno puede pasar de «publicado» a «confirmado» en un solo paso del
  comercio; los avisos y el scheduler ya tratan al confirmado.
