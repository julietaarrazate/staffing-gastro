# Landing "cielo": celeste y blanco, la comanda y el mapa de Palermo (#PR)

**Pedido:** Julieta, 2026-10-18. Comparó la landing con coofounder.app: le
gustaba el mensaje, pero se veía aniñada y cargada. Se iteró en una página de
prueba (artifact de Claude, unas veinte vueltas) hasta que pidió pasarla al
repo tal cual.

**Qué cambió:** lo que ve el visitante, de arriba hacia abajo.

1. **Inicio:** "Encontrá tu ___" con la palabra que cambia (mozo, bartender,
   bachero…) y una rueda de fotos de gente de gastronomía que gira despacio
   alrededor del título, sobre un cielo celeste que baja a blanco. Sin
   subtítulo: el título y los dos caminos. `HeroRueda.tsx`.
2. **"Pedilo como lo dirías":** un renglón para escribir el pedido como se
   habla; al tocar "Pedir" sale impresa una comanda (puesto, cuándo, paga) y
   cae "¡Oído!" fileteado. Es el momento de marca: banda de cielo, impresora,
   volutas y guarda de filete porteño. Se escribe sola la primera vez.
   `Comanda.tsx` + `lib/pedido-natural.ts` (lector en el navegador, con test;
   es una demostración, el pedido real lo lee la IA de `/shifts/parse-text`).
3. **"A pocas cuadras de tu local hay alguien libre para hoy":** el mapa de
   "va en camino" de la app sobre un pedazo de Palermo dibujado (Av. Santa
   Fe, Honduras, Costa Rica, Thames, Serrano, Juan B. Justo, plaza Serrano):
   aparecen los avisados, se postulan tres, Lucía queda elegida y viene a Tu
   bar ("~4 min"). Canvas, sin tiles remotos. `MapaCamino.tsx`.
4. **"Sabés quién entra a tu salón":** sólo la ficha de Lucía (sin foto, como
   la original); la lista de reglas salió.
5. **Precios:** nombre, precio, tope dibujado y una línea con lo que suma; sin
   botones por plan. Sigue leyendo la API con el respaldo de `planes.ts`.
6. **"Turnos de gastronomía cerca tuyo, cuando quieras":** una oferta como la
   ve el trabajador y un solo botón.
7. **Preguntas frecuentes:** sin "¿Cuánto cuesta?" (los precios están
   arriba); la de instalar sigue con `InstalarPasos`.
8. **Cierre** en claro, igual que el inicio, y **"oído" grande y fileteado**
   sobre el cielo con el pie (links y firma) debajo, en el mismo celeste.

En pantallas anchas, Confianza, Para trabajar y Preguntas ponen el título al
costado (`.landing-sec-dos`); en el celular todo va centrado.

Técnico: componentes nuevos `HeroRueda`, `Comanda`, `MapaCamino`; reescritos
`Confianza`, `Precios`, `ParaTrabajar`, `Preguntas`, `Cierre`,
`LandingFooter`, `LandingCorta`. Borrados `Hero`, `HeroNoche`,
`ComoFunciona`, `BarraCelular`, `RelojDelTurno`, `replicas` y
`useStoryShift` (sólo los usaba la landing corta; `/historia` tiene sus
propias copias en `story/`). Estilos `.landing-*` en `app/globals.css`;
salió el script `landing-js` de `app/page.tsx`, que sólo servía al hero
anterior. Fondo de la landing en blanco (`bg-card`). E2E de
`e2e/landing.spec.ts` actualizados (comanda nueva, sin barra de abajo).

**Por qué así:**

- **Una idea por sección y nada de texto que repita.** Julieta pidió varias
  veces sacar subtítulos, etiquetas, explicaciones bajo los pasos y textos
  grises ("Publicar tu primer turno es gratis", "Oído no te cobra nada"):
  la imagen ya lo dice. Por la misma razón salieron la barra fija de abajo
  ("molesta") y los botones de cada plan.
- **Celeste, blanco y el ámbar de siempre** ("el blanco, el cielo, más
  argentino"). Se probaron coral, albahaca, menta y rosa; volvió a la paleta
  v6 de `color-system.md`. El ámbar queda para el botón principal y la
  palabra que cambia.
- **La comanda y no un celular:** el celular con la app quedaba chico y no
  entraba en la pantalla; la comanda cuenta el nombre ("¡oído!" es lo que se
  contesta en la cocina) y es propia.
- **Filete porteño sólo en la palabra "oído"** (`Filete.tsx`): Julieta mandó
  carteles de referencia ("Pase y vea", "Corazón de tango", "Argentina"). Un
  cartel entero dentro de la comanda quedaba raro; quedó la palabra como en
  "Pase y vea" (letras crema y doradas, relieve ámbar, volutas, hojas
  celestes y flores) en la cinta de la comanda y en el "oído" del final.
- **Se descartó:** la noche atada al scroll (cortaba el lenguaje claro), los
  personajes de gelatina para arrastrar, el vidrio y la burbuja, la grilla
  de mosaicos con una cita inventada y el mapa de puntos (muy parecido al de
  Coofounder).

**Fotos de prueba** (`frontend/public/landing/`), todas en dominio público o
CC0, vía Openverse:

| Archivo | Título | Autor | Licencia | Fuente |
|---|---|---|---|---|
| `mozo1.webp` | Serving food | usbotschaftberlin | CC0 | https://www.rawpixel.com/image/8733360/photo-image-hands-public-domain-person |
| `mozo2.webp` | four fruity cocktails on a tray… | dolphingal805 | CC0 | https://wordpress.org/photos/photo/34464c8258/ |
| `mozo3.webp` | Waiter Drink | Matt Bango | CC0 | https://stocksnap.io/photo/waiter-drink-EWJPCRAR3S |
| `barista1.webp` | 130807-N-ZA585-113 | jesusdoesvegas | PDM | https://www.flickr.com/photos/22503760@N08/10231130293 |
| `barista2.webp` | Barista Coffee | Malidate Van | CC0 | https://stocksnap.io/photo/barista-coffee-ZCW5B7GXFY |
| `bar1.webp` | (sin título) | DNFGRD | PDM | https://www.flickr.com/photos/37951847@N08/45861675891 |
| `bar2.webp` | (sin título) | DNFGRD | PDM | https://www.flickr.com/photos/37951847@N08/44948434235 |
| `bar3.webp` | Emerald Hill | Tomas Forgac | PDM | https://www.flickr.com/photos/94173538@N00/5259863633 |
| `cocinera.webp` | The cook's smile… | Wonderlane | CC0 | https://www.flickr.com/photos/71401718@N00/6231890399 |
| `cocina1.webp` | Restaurant Kitchen | Michael Browning | CC0 | https://stocksnap.io/photo/restaurant-kitchen-0HCMIT272C |
| `cocina2.webp` | 鼎泰豐的廚房 | 灣熊 | CC0 | https://www.flickr.com/photos/139178527@N07/39986537155 |
| `cocina3.webp` | Chef Cook | Fabrizio Magoni | CC0 | https://stocksnap.io/photo/chef-cook-J2W0D3CO2L |

**Queda abierto** (también en `../STATUS.md`):

- **Fotos propias** de locales porteños para la rueda y la oferta: las de
  banco son de otros países y de calidad despareja. Es lo que más la haría
  ver profesional.
- **Prueba de gente real** (una cita corta de un local, con nombre) cuando
  haya locales usando Oído.
