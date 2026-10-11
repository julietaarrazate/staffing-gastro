# Publicar un turno: un paso menos y la dirección del local precargada

**Pedido:** Julieta, a partir de la auditoría de interfaz del 2026-10-11
(hallazgos U01, U02, U04 y B03, segundo y tercero de la lista de
prioridades).

**Qué ve el usuario:**

- **Ya no está el paso "¿Cuántas personas?"**: siempre valía 1 (un turno =
  una persona, ADR-0003). La aclaración pasó al primer paso: "Cada turno es
  para una persona: para varias, creá varios turnos o un evento".
- **Elegir el puesto avanza solo.** El botón Continuar del primer paso quedaba
  debajo de la grilla de puestos, fuera de pantalla en celulares.
- **El último paso usa la dirección del local** ("En tu local", con
  "Cambiar") en vez de pedir provincia y barrio en cada turno.
- **No se puede publicar sin ubicación.** Antes el botón "Publicar turno"
  estaba siempre activo y un turno sin coordenadas no aparecía en el mapa de
  los trabajadores. Si el local no tiene dirección cargada, el paso lo dice:
  "Elegí la zona para poder avisar a gente cerca".

Con el asistente paso a paso, publicar pasa de 9 toques a 6 (sin contar los
selectores de fecha y hora); con la IA, de 5 a 4 cuando el local tiene
dirección.

**Qué cambió (técnico):** `frontend/app/shifts/new/page.tsx`: `STEPS` con 4
pasos, renumeración de los saltos de la IA, carga de `GET
/companies/me/profile` para precargar `city`/`latitude`/`longitude` (no pisa
la ubicación de "Duplicar"), `canNext` y el botón Publicar exigen
coordenadas. E2E actualizados: `employer-wizard`, `publicar-turno-fecha`,
`shift-ai-parse` (ahora verifica la dirección precargada y las coordenadas
publicadas) y `subscription`.

**Por qué así:** el backend sigue aceptando `latitude` nula (otros caminos,
como eventos, no se tocaron); la exigencia queda en el formulario. Se mantuvo
el selector de zona como alternativa ("Cambiar") para turnos fuera del local.

**Queda abierto:** atajos de horario ("Ahora", "Esta noche", duración) y
"Urgente" automático (U03, U05 de la misma auditoría).
