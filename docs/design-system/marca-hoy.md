# La marca hoy (ficha corta)

> Estado al **2026-11-18** (letra Shrikhand e ícono «el pinche con oído»; la landing «con convicción» es del 2026-11-13). Una página para arrancar sin leer el historial.
> Brand system navegable para el diseñador (colores en los dos temas,
> tipografía, piezas y logos en vector): https://claude.ai/artifact/J8s5yUUpW3Ufz2hbWKYYns
> (privado: compartirlo desde su menú Share). Los vectores, con la letra
> convertida a trazos (se abren en Illustrator o Figma sin la fuente), están
> en [`marca/`](./marca/): `oido-filete` (con adornos, nivel «medio»),
> `oido-filete-cargado` (el de la miniatura), `oido-filete-marca`
> (sola, con relieve), `oido-filete-cinta` («¡Oído!»), `oido-plano` y
> `oido-plano-blanco`, `isotipo-pinche` (con relieve), `isotipo-pinche-chico`,
> `isotipo-pinche-maskable` e `isotipo-pinche-silueta` (el ícono vigente; los
> `isotipo-oi*` son el «oí» anterior, que queda de archivo), más el manual en
> PDF para el diseñador (`oido-manual-de-marca.pdf`, todavía con el «oí»).

> **2026-11-19:** la app pasa, pantalla por pantalla, a la **dirección suave**
> ([ADR-0028](../adr/ADR-0028-direccion-suave.md)): el cielo arriba y una hoja
> blanca encima, teclas y campos suaves, el título en letra normal grande y la
> brocha sólo para la marca. Las reglas de color de abajo siguen.

## En una frase

**Celeste y blanco con un solo ámbar**, porteña y gastronómica: el cielo de
Buenos Aires, el papel de la comanda y el filete de los carteles de bodegón.
(El rojo y el rosa existen sólo en las flores del filete: regla 3.)

## Reglas

1. **Una idea por sección** en la landing: título y una cosa. Sin subtítulos,
   etiquetas ni textos grises que repitan la imagen. Vale también para lo que
   se anima: un solo movimiento por sección (Julieta, 2026-11-13: "llamativa
   pero clara").
2. **Un solo ámbar por pantalla** (`--color-primary` `#D97706`, letra en
   tinta): la acción principal. Links, chips, avatares, íconos de rubro y
   pestaña activa van en celeste con azul hondo `#1C5478`. Lo "actual" de un
   indicador (el paso del `ShiftLifecycleStepper`, el círculo de comparar) es
   `bg-primary-text text-card`, nunca `bg-primary`. Un botón desactivado no usa
   opacidad: `surface` + `ink-mute` (`Button`: `primary`, `surface` y `ghost`).
3. **La marca es una sola: el «oído» en Shrikhand**, gorda e inclinada como la
   letra fantasía del fileteado (desde el 2026-11-17; antes Sancreek, que se
   iba al Far West y se parecía a la letra de otra marca del rubro). Fileteada en
   `components/landing/Filete.tsx`:
   - `firma` (con adornos): pantalla de inicio;
   - el final de la landing: la misma `firma`, entera, apoyada sobre un banco
     de nubes, que cierra el panel de cielo de «¿Te falta alguien hoy?»;
     sobre las nubes, sólo lo legal y el ©. Desde el 2026-11-18 (antes iba
     gigante y cortada por el borde, con el Sol de Mayo detrás: Julieta, «queda
     raro ese oído cortado»);
   - en el **encabezado de la landing y de la app** va la misma letra, **plana
     y en azul hondo** (`.landing-marca` desde el 2026-11-13; `components/Logo.tsx`
     desde el 2026-11-17, celeste en oscuro): con el relieve y el dorado
     chocaba con el resto, que es liso. El fileteado completo se ve una sola
     vez, al cierre;
   - `cinta` («¡Oído!»): la comanda.
   **Los adornos tienen cuerpo** (Julieta, 2026-11-18: los de línea fina
   dorada «quedaron demasiado finos»; eligió sobre una prueba con tres
   cargas, https://claude.ai/artifact/TYzBvehuyCPXNM7pNhrh6R, y pidió más
   profundidad). Son un dibujo propio en la tradición del filete porteño:
   volutas celestes con volumen (sombra, media luz y brillo, luz de arriba a
   la izquierda), relieve duro azul hondo y sombra proyectada, alas de hojas
   en las esquinas, filete dorado por dentro y flores de cinco pétalos con
   botón azul. Dos niveles, y no se mezclan:
   - **medio** en el final de la landing y en la bienvenida: cuatro volutas,
     una flor roja arriba y una rosa abajo;
   - **cargado** sólo en la miniatura para compartir
     (`assets/og/filete-oido.png`), que se ve chica y de pasada: suma el ramo
     de tres flores, una flor a cada costado, la cinta celeste y blanca y
     rulos dorados arriba.
   **El rojo y el rosa viven sólo adentro del filete**, en las flores, igual
   que el crema vive sólo adentro de la letra: no son colores de la interfaz
   y el ámbar sigue siendo el único acento de las pantallas. **La letra no
   cambió**: crema con relieve azul hondo (el relieve rojo se probó y se
   descartó: compite con las flores y obliga a rehacer el ícono y la cinta).
   El dibujo no se toca a mano: lo escribe
   `frontend/scripts/build-filete.mjs` (el módulo que usa `Filete.tsx`, los
   dos vectores de [`marca/`](./marca/) y el PNG de la miniatura).
   No va en ningún otro lugar ni con otra palabra.
4. **El ícono es el pinche con «oído»** (Julieta, 2026-11-18, después de
   verlo; reemplaza al «oí» provisorio del 2026-11-17, y antes a las manos y
   la oreja, que en chico se parecían al ícono de otra marca del rubro): la
   comanda de papel clavada en el pinche de la cocina, con la palabra «oído»
   fileteada en el papel (el pedido que queda a la vista hasta que alguien lo
   toma). Papel blanco, pinche celeste y letra crema con relieve sobre azul
   hondo `#1C5478`; el relieve duro `#0F3A5B` corrido abajo a la derecha es
   el del filete. **Grande** (con relieve y la palabra): app en el celular,
   Apple, 192 y 512, `public/logo-mark.svg`. **Con margen** para Android
   (`logo-maskable.svg`): la misma, achicada para entrar entera en la zona
   segura (círculo central del 80 %) y con el fondo azul a sangre. **Chica y
   plana** de 48 px para abajo (pestaña, `favicon.ico`, encabezado de
   `/bienvenida`: `logo-mark-chico.svg`): la misma comanda con la «o» sola,
   sin relieve, porque la palabra no entra y el relieve se empasta. En
   **silueta de un solo color** (papel, pinche y base, con la «o» calada)
   para el badge de las notificaciones de Android y los estados vacíos
   (`logo-figure.svg`) de 24 px para arriba; **por debajo de 24 px** (el
   glifo de 14 y 18 px en el asistente y las réplicas de la landing) la
   silueta entera no se lee y va **la «o» sola** de un color (`logo-o.svg`).
   Es **sólo ícono de la app**: no va al lado de la
   palabra «oído» en encabezados ni en la landing, y el Sol de Mayo no se
   usa. La letra va **convertida a trazos** (no depende de la fuente):
   `frontend/scripts/build-isotipo-pinche.py` escribe los vectores (en
   `public/` y en [`marca/`](./marca/)) y `node scripts/build-icons.mjs` los
   PNG y el `.ico`. **En los mails** (desde el 2026-11-28) va la chica arriba
   y la palabra «oído» plana en azul hondo en el pie, las dos como PNG del
   sitio (`frontend/public/mail/`, del mismo script): Gmail no muestra SVG.
   El resto del mail sigue las reglas de pantalla: lienzo claro sin brillos
   ámbar, título en Inter gruesa y el ámbar sólo en el botón.
5. **Lo que no se hace, para no parecerse a otra marca del rubro** (crema,
   azul francia, grabados y un ticket; análisis del 2026-11-17 en el
   historial): el crema
   vive sólo adentro de la letra fileteada, nunca como fondo; el ámbar nunca
   va en notas, garabatos ni subrayados (eso va en azul hondo); la comanda es
   papel de cocina, no un ticket (sin número, sin raya punteada, datos en
   Inter); nada de ilustración de línea en azul.
6. **Modo oscuro = noche azul** (lienzo `#0D131A`, tarjeta `#151D26`, grises
   fríos, brillo celeste). Nada de café ni resplandor naranja.
7. Barra del celular (`theme-color`) blanca en claro, noche azul en oscuro.
8. **La landing usa tres superficies con borde claro, sin degradés que se
   lavan** (2026-11-13), en paneles con margen y esquinas redondas:
   **cielo pleno** con nubes para abrir y cerrar, **celeste plano** para el
   panel de la comanda y el plan del medio, y **noche azul** para «Turnos
   cerca tuyo» (ahí se le habla a quien trabaja). El resto, blanco. El mapa
   va en celeste, no en beige. El ámbar queda sólo en la palabra que cambia
   del inicio.

**Foco: un solo indicador por elemento.** El contorno global de
`globals.css` (`:focus-visible`, 2px, `--focus-ring`: azul de marca en claro,
celeste en oscuro) es el único. Los campos y botones NO suman un anillo propio
(`focus:ring-2 focus:ring-primary/40` y similares): se veían dos juntos, ámbar
sobre celeste, y en el celular el tap enfoca los campos. De reposo queda el
borde fino (`ring-1 ring-line`) y, en error, `ring-danger`. Dos excepciones, con
clase en `globals.css`: `.foco-contenedor` (el contenedor de un campo sin borde
propio dibuja el contorno y el input lleva `data-foco-contenedor`) y
`.foco-propio` (un enlace que cubre una tarjeta y dibuja su ring por dentro;
apaga el global). `outline-none` de Tailwind no apaga el global (no tiene
capa). Lo cuida `frontend/e2e/un-solo-foco.spec.ts`.

## Paleta

| Rol | Claro | Oscuro |
|---|---|---|
| Lienzo | `#F8FBFC` | `#0D131A` |
| Tarjeta | `#FFFFFF` | `#151D26` |
| Recesado | `#E5EEF1` | `#1C2631` |
| Tinta / suave / apagada | `#111111` / `#4B5563` / `#686572` | `#EEF3F6` / `#A9B6C2` / `#8494A3` |
| Celeste / fuerte / tinte | `#C4E3ED` / `#9AC9E7` / `#DEECF0` | velo celeste 12–14 % / `#9AC9E7` |
| Azul hondo (links, letra sobre celeste) | `#1C5478` | `#9AC9E7` |
| Ámbar (acción) / como texto | `#D97706` / `#B45309` | `#D97706` / `#E8920F` |
| Cielo de la app (desde el 2026-11-19; `--app-cielo-*`): de arriba a abajo, con una luz suave arriba a la derecha; tinta | `#5BA8E0` → `#84C0EC` → `#BFE1F6`; `#0F3A5B` (4,6 sobre el tono más oscuro) | `#0B1A28` → `#0F2233` → `#12283B`, con estrellas y sin nubes; `#EEF3F6` |
| Landing (2026-11-13; variables `--l-*` en `globals.css`): cielo de arriba a abajo, celeste plano, noche, azul de la marca plana | `#6FB0DF` → `#8CC2E7` → `#B4D8EF` → `#DCEDF7`, `#E2EEF6`, `#0D131A`, `#0F3A5B` | igual (la landing es siempre clara) |
| Filete, la letra (desde el 2026-10-23): cara crema, filete interior blanco, borde y relieve azul hondo, canto dorado | `#FFF9DC` → `#F2DC9A`, `#FFFFFF`, `#14456A` / `#1C5478`, `#C98A1A` | igual |
| Filete, los adornos (desde el 2026-11-18; sólo adentro del dibujo): volutas celestes, relieve, filete dorado, flor roja, flor rosa, botón | `#D6EEFC` → `#74B8E8` → `#2B7CC0`, `#0F3A5B`, `#FBE69A` → `#EEBB4A` → `#C98A1A`, `#F2685F` → `#D8262F` → `#8F1420`, `#FDE3E8` → `#F29BB0` → `#C9486B`, `#9AC9E7` → `#1C5478` | igual |

Detalle y contrastes: [`color-system.md`](./color-system.md).

## Tipografía

| Familia | Uso |
|---|---|
| **Young Serif** | Títulos de la landing y de pantalla (desde el 2026-11-16: el medidor marcó la letra neutra de Schibsted Grotesk, que regía desde el 2026-10-18; un solo peso) |
| **Inter** | Texto, botones, inputs |
| **DM Mono** | Rótulos de la comanda, horarios |
| **Shrikhand** | Sólo la palabra «oído», fileteada o plana, y la «o» del ícono (no va como fuente en el ícono: está convertida a trazos; desde el 2026-11-17; antes Sancreek; recorte local de 1,5 KB) |

Detalle: [`typography.md`](./typography.md).

## Piezas propias

La comanda impresa con la cinta «¡Oído!», el mapa «va en camino» sobre
Palermo dibujado, la rueda de fotos del inicio y la miniatura al compartir.

## Pendiente

- **Fileteador para el isotipo (opcional):** el pinche con «oído» ya es el
  ícono en el código, dibujado por nosotros. Si se encarga a un fileteador,
  que parta de `marca/isotipo-pinche*.svg` y mantenga el concepto cerrado.
- **La dirección «con relieve» ya no rige en la app** (2026-11-21): la app
  entera usa la dirección suave ([ADR-0028](../adr/ADR-0028-direccion-suave.md):
  el cielo, la hoja y sombras difusas). El relieve del filete
  ([ADR-0027](../adr/ADR-0027-relieve-como-profundidad.md)) sigue sólo en la
  landing (`/` y `/historia`, con la letra mixta de
  [`typography.md`](./typography.md)) hasta que se decida aparte.
- **Fotos propias** de locales porteños (hoy son de banco); qué va en cada
  lugar, en [`fotos-landing.md`](./fotos-landing.md).
- Una **cita real** de un local cuando haya locales usando Oído.

## Descartado

La noche atada al scroll, personajes de gelatina, vidrio y burbujas, el mapa
de puntos, paletas coral/albahaca/menta/rosa, la barra fija abajo, el cartel
fileteado entero en la comanda, el modo oscuro café. (Los botones por plan
estuvieron acá del 2026-10-18 al 2026-10-30: volvieron, "Empezar con
<plan>", en tinta o con borde, sin ámbar.)

## Dónde se decidió

`docs/historial/`: `2026-10-18-landing-cielo`, `2026-10-18-miniatura-filete`,
`2026-10-18-titulos-schibsted`, `2026-10-19-app-noche-azul`,
`2026-10-19-marca-filete-header`, `2026-10-19-splash-filete`,
`2026-11-18-filete-adornos-con-cuerpo`.
