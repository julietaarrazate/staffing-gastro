# Paleta violeta, títulos de 48px y ritmo más lento en la landing

**Pedido:** Julieta, 2026-10-08, en el hilo "Identidad de marca de Oído".
Una pasada de correcciones sobre la landing, primero en el celular y
después en escritorio: los titulares Fraunces de 32px a 48px; revisar todos
los CTA principales y corregir sus colores; bajar un 25% la velocidad del
scroll y de la animación automática; revisar los espacios entre elementos
pensando en la pantalla estándar del celular; el verde bosque (`#17312A` y
parecidos) pasa a un degradé `#5c22cf` → `#8e69d8`, los botones y
destacados `#d97706` pasan a `#ffab25`, y la crema y la manteca a
`#f3f3f3`; si hace falta ampliar la paleta, dentro de la gama entre
`#f3f3f3` y `#8e69d8`. Entrega en una previsualización HTML. En la tarjeta
de decisión eligió **"Toda la app"**: es la paleta de la app entera,
probada primero en la landing. Pidió además un PDF del design system.

**Qué cambió:**

1. **Paleta, como tokens.** Un bloque `[data-palette="violeta"]` en
   `frontend/app/globals.css` redeclara los tokens (lienzo, superficies,
   acción, marca, manteca, noche, anillo de foco) y lo prende sólo la raíz
   de la landing (`LandingStory.tsx`). La app no cambia hasta que ese
   bloque pase a `:root`. Valores, reglas y contrastes:
   [`design-system/color-system.md`](../design-system/color-system.md),
   sección "Propuesta v6".
2. **El degradé de marca** es la utilidad nueva `bg-brand`
   (`--gradient-brand`, radial, con el brillo `#8e69d8` en la esquina de
   abajo a la derecha). Sin la paleta violeta, `bg-brand` es el
   `bg-secondary` de siempre. Lo usan las superficies grandes: el
   resultado del turno, la tarjeta "Recomendado" (`CandidateCard`) y el
   banner del mozo (`lib/skill-style.tsx`).
3. **CTAs.** Relevados uno por uno (encabezado, hero, "Publicar turno",
   "Confirmar", banda del "¡Oído!", resultado, precios): todos los
   primarios son `#ffab25` con texto en tinta (9,98:1; el blanco daba
   1,89). El mismo "Necesito personal" salía en tres rellenos: en el
   encabezado, noche o manteca según el tramo, y ámbar en el inicio. Ahora
   es uno solo, salvo sobre la banda ámbar, donde va en tinta. Los
   secundarios son transparentes con borde (tinta 60% sobre claro, blanco
   80% sobre el degradé). "Voy en camino" en el celular de
   Lucía queda neutro también en escritorio, para no tener dos botones
   ámbar en el mismo panel.
4. **Titulares de narración a 48px** (`--text-headline`, nuevo, línea
   1,04). Para que el producto no pierda lugar, cada escena mide el alto
   real de la narración de cada estado (`narrHeights` en `layout.ts`) en vez
   de reservar el del más alto.
5. **Ritmo 25% más lento.** Scroll por estado, duraciones y resortes
   multiplicados por 4/3. Detalle en
   [`design-system/motion.md`](../design-system/motion.md).
6. **Espacios en el celular** (390×844 como marco de referencia, revisado
   también a 390×664 y 1440×900): el mapa y el celular ya no tocan la
   narración, el celular no tapa el rótulo de la escena, los anillos de los
   motivos no quedan encima de "Asignado", y la narración de la elección se
   apaga al confirmar (antes quedaba encendida).
7. **Contraste de toda la landing medido**, texto por texto sobre su fondo
   real, en los dos modos (animado y "reducir movimiento"). Arreglos que
   salieron de ahí: rótulo de la franja del reloj sobre violeta (3,28 → 5,19),
   "Ubicaciones aproximadas" sobre el mapa (4,49 → 4,58, el mapa pasa a
   `#e9e5f0`), borde del secundario sobre el degradé (60% → 80%), textos del
   resultado al 85–90% de blanco. Las tarjetas que pintan el degradé en una
   capa al lado del texto (`OpportunityCard`, `ShiftCard`) no las veía ese
   script; medidas aparte con píxeles, la distancia de la tarjeta del turno
   pasó del 70% al 85% de blanco (3,98 → 5,09, cambio que vale en toda la
   app) y el anillo de foco sobre el violeta pasó a blanco (el ámbar daba
   2,15 en el brillo del degradé). Las dos las marcó la revisión del PDF.
8. **Dos arreglos que valen ya en toda la app**, también con la paleta de
   v5.0: la inicial de los avatares sin foto va en tinta (`ui/Avatar`,
   `map/WorkerMarker`; en el centro del avatar el blanco daba 3,99 y la
   tinta da 4,74), y el rótulo "Recomendado por Oído" de `CandidateCard` va
   en manteca y no en ámbar (sobre el verde bosque daba 3,89; ahora 9,83).
9. Al final de la página, en escritorio, el encabezado quedaba violeta
   encima de los precios: el resultado terminaba 8px debajo del encabezado.
   Ahora el tono se lee 24px más abajo (`LandingHeader.tsx`).
10. **Next.js de 16.3.6 a 16.4.0.** El 2026-10-09 salieron avisos de
    seguridad nuevos para Next 16.0.0–16.3.7 (envenenamiento de caché en
    SSG/ISR, SSRF en la optimización de imágenes, entre otros), y `npm audit`
    del workflow Security quedó en rojo para cualquier PR. No es parte del
    pedido: entró acá porque sin eso este PR no se puede mergear. tsc, lint,
    Vitest, build y los 137 e2e pasaron con la versión nueva.
11. **Carrera en `e2e/shift-ai-parse.spec.ts`.** Leía el cuerpo del POST de
    "Publicar turno" en el mismo instante del click, que resuelve antes de
    que salga el request: a veces daba null (falló en CI y una vez en local,
    sin relación con la landing). Ahora espera el request, como ya hacía el
    mismo test con "Completar". 30 de 30 corridas seguidas en verde.

**Por qué así:**

- **Tokens y no colores sueltos**, porque Julieta eligió que sea la paleta
  de toda la app: llevarla a la app es mover un bloque a `:root` y armar su
  versión oscura, no recorrer componentes.
- **El degradé es radial y no una diagonal.** Con `linear-gradient(155deg)`
  la letra chica blanca de las tarjetas y del resultado caía en la punta
  clara (3,4 a 4,0:1). El texto de esas superficies arranca arriba a la
  izquierda y el botón o el ícono va abajo a la derecha, así que el brillo
  va ahí. Medido con las esquinas y el centro de cada caja de texto: nada
  baja de 4,5 a 390 ni a 1440px.
- **`#ffab25` nunca como texto sobre claro** (1,70:1): el texto destacado
  pasa a violeta `#5c22cf` (7,32). Por la misma razón el anillo de foco es
  violeta sobre claro, ámbar sobre la noche y blanco sobre el violeta.
- **La landing sigue sin oscurecerse** con el tema oscuro (se verificó con
  `theme=dark`): fija `data-theme="light"`.

**Medido y no tocado (anterior a este cambio):** unos grises chicos de las
tarjetas que salen en la landing. En `OpportunityCard`, el rótulo "Pago" en
tinta al 40% (2,61:1 sobre blanco, línea 219) y el pago por hora al 50%
(3,54:1, línea 222). La duración ("· 5 h") va al 45% (3,03:1), en
`OpportunityCard` (línea 233) y en `ShiftCard` (línea 338), y también el
rótulo "PAGO" de `ShiftCard` (línea 269). Los pasos futuros del
`ShiftLifecycleStepper` van al 35% sobre `#e9e5f0` (2,21:1, línea 147). La
primera lista que quedó acá tenía sólo dos; los demás los encontró la
revisión del paquete para el diseñador. Quedan para la pasada de la app.

**Queda abierto:** que Julieta apruebe la paleta y el borde del botón
secundario sobre el violeta (el pedido decía blanco al 60%, que en el
brillo del degradé da 2,48:1 y un borde pide 3:1; quedó en 80%). Después: pasar el bloque
a `:root`, armar la versión oscura y revisar los lugares de la app que
todavía llevan texto blanco sobre ámbar (`ImageUpload.tsx`,
`app/search/page.tsx`, la splash y los encabezados de comercio y
trabajador). El logo sigue en el ámbar `#d97706`: falta decidir si pasa al
`#ffab25` (con la mano en tinta) o a un cuadrado violeta.

**Después (2026-10-09):** Julieta pasó a celeste claro lo que era violeta;
el resto quedó como acá. Lo que cambió y por qué, en
[`2026-10-09-paleta-celeste.md`](./2026-10-09-paleta-celeste.md).
El resto de esta entrada (titulares, ritmo, espacios, Next.js) sigue igual.
