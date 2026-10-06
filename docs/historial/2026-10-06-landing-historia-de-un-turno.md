# La landing pasa a ser la historia de un turno (#405)

**Pedido:** Julieta, 2026-10-06, en el hilo "Identidad de marca de Oído".
Rechazó las tres direcciones de marca ("no me gusta ninguna") y pidió
primero la landing, tratada como una pieza de product marketing de primer
nivel: una secuencia que se recorre con el scroll, con la narrativa
URGENCIA → DESCUBRIMIENTO → MATCH → CONFIRMACIÓN → CONFIANZA → RESULTADO, el
producto real como protagonista y movimiento con intención (nada que se
mueva sólo por moverse). Pidió además recorrerla, corregir los momentos
flojos y repetir, en celular y escritorio.

**Qué cambió:** la página de "/" sin sesión cuenta UN turno de un viernes,
de punta a punta, con las piezas reales de la app:

1. **Hero + urgencia** (`ActoNoche`): qué es y los dos botones arriba de
   todo; al primer scroll la noche crece desde su ventana, cae "Perdón, hoy
   no llego." y la burbuja se condensa en el **reloj del turno**, una franja
   bajo el encabezado que acompaña toda la historia (20:46 · sin cubrir →
   20:54 · cubierto → llegó).
2. **Silencio**: "¿Y ahora a quién llamás?", sin nada que se mueva.
3. **Pedido** (`ActoPedido`): la frase se escribe con el scroll, sus tres
   partes vuelan a los campos de la `OpportunityCard` real, la tarjeta se
   achica hasta ser su propio pin en el mapa, las ondas encienden a los
   avisados y el pin de Lucía se abre en su celular (push real del backend,
   "Postularme", toast real).
4. **Corte** "Mientras tanto, en tu bar." (con el link para trabajadores).
5. **Elección** (`ActoOido`): los pines vuelan a la lista de candidatos
   (`CandidateCard` real), anillos que unen cada motivo con su dato, Asignar,
   el celular de Lucía con su `ShiftCard` y Confirmar, y del botón nace el
   **"¡Oído!"** en ámbar, el pico de la página. Banda ámbar con el CTA.
6. **Llegada** (`ActoLlegada`): el lienzo se abre en un círculo; la
   `ShiftCard` del local con el mapa de "va en camino" (su última posición,
   saltos, línea recta, tiempo con "~" de `estimateArrivalMin`), y "Llegué".
7. **Confianza** (ficha de qué se verifica de cada lado), **Resultado** (el
   registro del turno, en verde bosque), **Precios** como carta (con
   respaldo si la API no contesta) y pie.

Lo técnico: todo vive en `frontend/components/landing/story/`
(`LandingStory.tsx` arma el orden; `useStage.ts` es el motor de escena
fijada; `layout.ts` la geometría compartida; `replicas.tsx` las piezas que
no se pueden mostrar sin backend/MapLibre). `app/page.tsx` quedó en el
redirect por rol + `<LandingStory />`. Se borraron los siete componentes de
la landing anterior (`ScrollHeroShowcase`, `StatsStrip`, `PricingPlans`,
`HowItWorksTimeline`, `PositionsMarquee`, `ParallaxCard`, `Reveal`) y el
`@keyframes marquee`. El `Navbar` y la splash no se muestran en "/" sin
sesión (la landing trae su encabezado).

De paso, **coma decimal en toda la app**: `formatDecimal1`/`formatKm` en
`lib/format.ts`, aplicados al rating (`ui/Rating`), a las distancias de
`CandidateSignals`, `EnRouteMap` y `OpportunityCard`. La misma pantalla
mezclaba "0.6 km" en la tarjeta con "0,6 km" en la push.

Tests: `e2e/landing.spec.ts` (hero y destinos de los botones, recorrido
completo sin errores ni scroll horizontal a 390px, precios desde la API y
con la API caída, tema oscuro, reducir movimiento), `lib/format.test.ts` y
`components/landing/story/useStage.test.ts`.

**Por qué así:**

- **Una historia y no secciones de features.** Cada escena responde la
  pregunta que deja la anterior ("¿a quién llamo?" → "¿quién viene?" → "¿viene
  o no viene?" → "¿puedo confiar?"), y cada cosa sale de la anterior: la
  frase se convierte en tarjeta, la tarjeta en pin, el pin en celular, el
  botón Confirmar en el "¡Oído!". Nada aparece de la nada.
- **El scroll manda, nunca se secuestra.** El progreso de cada escena es la
  posición de la página. Los botones de la historia ("Completar", "Asignar",
  "Llegué") mueven el scroll hasta el paso, así estado y scroll coinciden.
- **Progresión de energía con pausas.** Silencio después del primer pico,
  corte con scroll libre entre escenas fijadas (nunca más de ~2,5 pantallas
  fijadas seguidas) y una sola explosión de color, el "¡Oído!".
- **Honestidad.** Nombres y horarios son de ejemplo y lo dice la página
  ("Historia ilustrativa"); los 10 minutos se presentan como objetivo, no
  como dato; los textos de push y toasts son los del backend y la app; el
  check-in "queda con su ubicación", no "verificado"; la línea de "va en
  camino" es recta y el tiempo lleva "~".
- **La landing no se oscurece con el tema.** Fija `data-theme="light"`: su
  contraste de tramos (noche, ámbar, bosque) ya es el diseño, y con el tema
  oscuro quedaba una noche dentro de otra noche.
- **motion 13 "acelera" `useTransform(scroll, [..], [..])`** a una animación
  nativa atada a ViewTimeline que no sigue al scroll dentro de un `sticky`
  (el hero quedaba visible encima de la noche). Todas las escenas usan
  `useRange` (forma con función, calculada en JS). Ver el comentario en
  `useStage.ts`.

Descartado: un video embebido (no se puede tocar, pesa y no usa el producto
real), mockups de celular flotando con inclinación, la grilla de features y
los contadores de la landing anterior (cifras sin fuente).

**Queda abierto:** el sí de Julieta, con cuatro cosas para confirmar:
"Beta en Palermo" en el hero, "Tu bar" como nombre del local de ejemplo,
"Para trabajar no se paga nada" en precios, y que "Oído arma el turno"
depende de `GEMINI_API_KEY` en Render. Si se mergea, el paso siguiente que
pidió es llevar este nivel de movimiento a la interfaz de la app.
