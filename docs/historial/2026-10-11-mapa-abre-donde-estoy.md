# El mapa del trabajador abre donde está la persona

**Pedido:** Julieta reportó que el mapa siempre le mostraba la zona donde
trabaja y no donde estaba. Confirmado en la auditoría de interfaz del
2026-10-11 (hallazgo B02, cuarto de la lista de prioridades).

**Qué ve el usuario:** al abrir `/map`, la cámara queda en su ubicación real
y la primera tarjeta es el turno más cercano (los urgentes siguen primero,
igual que en `/feed` y `/buscar`). El mapa recién se mueve a un turno cuando
la persona toca un pin o desliza las tarjetas.

**Qué cambió (técnico):**

- `frontend/app/map/page.tsx`: ordena con `sortByDistance` (de
  `lib/current-location.ts`) al cargar el feed y cuando llega el GPS, salvo
  que la persona ya esté eligiendo tarjetas. Calcula `followActive`: sigue a
  la tarjeta activa si la persona interactuó o si todavía no hay ubicación
  (GPS pendiente o negado, para no quedar en el Obelisco sin turnos a la
  vista).
- `frontend/components/worker/ShiftMap.tsx`: el acercamiento a la tarjeta
  activa sólo corre con `followActive`. Antes corría también al abrir y
  pisaba el vuelo a la persona.

Test nuevo: `frontend/e2e/mapa-donde-estoy.spec.ts` (con el backend mandando
primero un turno lejano, la primera tarjeta es la cercana).

**Por qué así:** el acercamiento a la tarjeta lo había pedido un reporte
anterior ("dirigirte directamente a la dirección") y sigue valiendo cuando la
persona elige un turno; el problema era que también corría en la carga. Se
descartó encuadrar persona y turno más cercano juntos (`fitBounds`) para no
cambiar el zoom de apertura en este PR.

**Queda abierto:** el buscador del comercio (`/search`) sigue cayendo en
silencio al Obelisco si falla el GPS (hallazgo B05).
