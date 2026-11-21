# El ícono del asistente es la oreja (#PR)

**Pedido:** Julieta vio tres dibujos en maqueta (la «o» de oído, una oreja, un globo con onda de voz) y eligió la oreja para reemplazar las estrellitas genéricas del asistente.

**Qué cambió:** el campo «¿Qué necesitás?» (Panel del comercio y Inicio de quien trabaja) lleva una oreja de trazo en el azul hondo de los links (`text-primary-text`, 22 px) en lugar de las estrellitas. `OrejaIcon` está en `frontend/components/icons.tsx`: dibujo propio de dos trazos (borde y pliegue), 24×24, grosor 1,75, terminaciones redondas, `currentColor`, tamaño por prop y decorativo (`aria-hidden`) como el resto del set. Se usa en `frontend/components/AIAssistantBar.tsx`, el único lugar donde las estrellitas representaban al asistente. Test unit en `frontend/components/icons.test.tsx`.

**Por qué así:** se pulió el dibujo del prototipo mirándolo a 16, 18, 24 y 64 px en claro y oscuro: se ensanchó el borde y se agrandó el pliegue para que a 16 px se lea como oreja y no como un signo de pregunta. Se usó `createLucideIcon` para heredar exactamente el comportamiento de los demás íconos. `SparklesIcon` sigue existiendo y se deja donde no es el asistente: «Turno publicado» (`ShiftPublishedNextSteps`), «Descubrir rápido» (`app/feed`), «Paga por encima de lo típico» (`ShiftDetail`), el botón del plan destacado (`PlanCard`) y «Sugerencia de IA» del soporte para admin (`app/support/[id]`). La pantalla `/assistant` no llevaba un ícono del asistente (sólo flecha y micrófono), así que no cambia.

**Queda abierto:** «Sugerencia de IA» en soporte (vista de admin) sigue con estrellitas: es una función de IA, no el asistente; si Julieta quiere la oreja ahí, es un cambio de una línea.
