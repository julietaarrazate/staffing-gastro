# Cierre de la etapa 3 de la beta

**Pedido:** Julieta, 2026-11-17: implementar las diez decisiones de la etapa 3,
M6, los grupos H y E y los pendientes de las tandas 1 a 3, y cerrar la etapa
(«Terminá todo lo pendiente de la etapa 3»).

**Qué entró (todo con revisión independiente; prueba en la app con
`tools/e2e-local` para lo que cambia comportamiento):**

- #616 U101: fecha de nacimiento en el alta y nadie menor de 18 (versión legal
  `2026-11-17-2`, con el «sí» de Julieta).
- #617 U084: cancelar un evento entero con las reglas de cada puesto.
- #618 U018 + U111: aviso «Cerró tu turno · Calificá…» y calificación definitiva.
- #615 U039: mail de aviso cuando Google reclama una cuenta.
- #619 M6: plan elegido al darse de alta (en el servidor) y compromiso de pago
  registrado por la admin; métricas con un solo universo (sin cuentas de prueba).
- #620 grupo E: hora 24 h, plata con «$», distancias con coma, plurales,
  «Matches» y «Panel», textos de sin conexión y de límite.
- #621 pendientes de las tandas 1 y 2: `danger-text`, «Garantía Oído» con el
  turno cerrado, recorte de avisos largos.
- #623 U110: reportar un turno o un comercio desde soporte.
- #624 pendientes de la tanda 3: indicador de etapas en azul, deshabilitado
  legible, guardas de rol en `/feed` y `/search`, e2e de «Descubrir rápido».
- H (#609) y N (#608, #611) los cerró otra sesión el mismo día (#610).
- Este PR: U106 (`docs/reference/QUE_EXISTE_HOY.md`: el asistente no responde
  por la verificación), tablero y STATUS.

**Decisiones de Julieta en la sesión (anotadas en el tablero):** regla de
cambio de plan para cuando se encienda el cobro (subir inmediato con
prorrateo, bajar a fin de mes, el contador no se reinicia); Mercado Pago como
pasarela (Stripe no abre cuentas a negocios de Argentina). Decisiones de la
sesión: «Panel» como nombre de `/shifts` del comercio; el plan elegido se
registra sólo al terminar el alta; un trabajador puede atar a un ticket
cualquier comercio cuyo perfil público ve.

**Por qué así:** un PR por tema y en paralelo, cada uno revisado por otro
agente que intentó romperlo. Las migraciones de U101 (0048), M6 (0049) y
U110 (0050) se numeraron al mergear, en ese orden. Cada PR trajo `main` y
esperó su CI después del merge anterior.

**Queda abierto:** en el tablero («Para revisar con Fable», etapas 4 a 6) y
en STATUS. Julieta pidió anotar en la etapa 5 el paso a TypeScript 7
(compilador en Go, unas 10 veces más rápido): no cambia nada para los usuarios
y acelera CI y el editor.
