# La voz de la app

> Vigente desde el **2026-11-28** (revisión de voz con Julieta). Rige los textos
> de pantallas, avisos (campanita y push) y mails. Lo de redes y el
> diagnóstico que llevó a esto viven en el documento privado de crecimiento
> (pestaña «Voz y firma»), no acá.

La app habla como un compañero del pase, en voz baja: primero el dato, y como
mucho una palabra de cocina por pantalla o por aviso.

## Reglas

1. **Compañero del pase, no encargado ni sistema.** Fuera «el trabajador
   asignado», «la otra parte», «el sistema», «tu desempeño», «asistencia»,
   «gestioná», «oportunidades».
2. **Un verbo por acto.** El local *elige*; quien trabaja *confirma*. No
   «asignar» ni «aceptar» para el mismo acto.
3. **Nombre propio antes que rol.** «Ana Pérez confirmó», «Bar Palermo Soho
   te eligió». El nombre sale del turno; sin nombre, «la persona elegida» o
   «el local», nunca un hueco.
4. **El dato antes que el adjetivo:** puesto, día, hora y plata. En un aviso
   que queda guardado (campanita, mail) el día va con fecha, «el domingo 29/11
   a las 19:00», nunca «mañana»: se puede leer al otro día
   (`format_dia_y_hora_art` en `backend/app/core/tz.py`).
5. **«¡Oído!» se dice sólo cuando alguien dijo que sí.** Nunca como saludo ni
   como remate.
6. **Humor sólo donde no hay nada en juego:** vacíos, bienvenida, espera. Con
   plata, cancelaciones, ausencias, verificación o errores, claro y corto.
7. **No prometer lo que depende de otro.** «Va en camino» lo prende la
   persona: el aviso de «confirmó» dice «si avisa que sale para allá, te llega
   otro aviso», no «te avisamos cuando salga».

## El léxico del pase

Cada palabra tiene su momento: *cantar* (publicar), *marchando* (buscando),
*¡oído!* (confirmado), *sale* (cubierto). Una por pantalla.

## La firma en los vacíos

- **El pinche** (la silueta por defecto de `EmptyState`) quiere decir «acá
  todavía no hay nada clavado»: va en los vacíos **de turnos** (Mis turnos,
  Candidatos, Chats), en la página no encontrada y en el cargando.
- En los vacíos que no son de turnos (Favoritos, Soporte) va un ícono propio,
  no el pinche. Uno por pantalla.
- La cinta «¡Oído!» fileteada sigue con la regla 3 de
  [`marca-hoy.md`](./marca-hoy.md): sus dos usos nuevos propuestos (al
  confirmar y en el mail «Te eligieron») esperan otra decisión.

## No se tocan con esta voz

Términos y Privacidad; planes y precios; los textos de «Va en camino» y
«Disponible ahora»; la pregunta «¿Seguís disponible para este turno?»; todo lo
de ausencias, cancelaciones y reputación. Cambiar un texto no cambia a quién
le llega un aviso.

## Dónde viven los textos

| Qué | Dónde |
|---|---|
| Avisos al elegir, confirmar, turno nuevo cerca y salida | `backend/app/modules/shift/application/services.py` |
| Aviso de calificación | `backend/app/modules/review/application/services.py` |
| Mails (asuntos y cuerpos) | `backend/app/modules/identity/application/services.py`, `backend/app/modules/notification/domain/email_templates.py` |
| «Postulación enviada a…» (las cinco pantallas) | `postulacionEnviada` en `frontend/lib/applications.ts` |
| Vacíos | `frontend/components/ui/EmptyState.tsx` y cada pantalla |
