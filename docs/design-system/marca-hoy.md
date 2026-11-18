# La marca hoy (ficha corta)

> Estado al **2026-11-17** (letra Shrikhand e ícono «oí»; la landing «con convicción» es del 2026-11-13). Una página para arrancar sin leer el historial.
> Brand system navegable para el diseñador (colores en los dos temas,
> tipografía, piezas y logos en vector): https://claude.ai/artifact/J8s5yUUpW3Ufz2hbWKYYns
> (privado: compartirlo desde su menú Share). Los vectores, con la letra
> convertida a trazos (se abren en Illustrator o Figma sin la fuente), están
> en [`marca/`](./marca/): `oido-filete` (con adornos), `oido-filete-marca`
> (sola, con relieve), `oido-filete-cinta` («¡Oído!»), `oido-plano` y
> `oido-plano-blanco`, `isotipo-oi` (fileteado), `isotipo-oi-chico`,
> `isotipo-oi-maskable` e `isotipo-oi-silueta`, más el manual en PDF para el
> diseñador (`oido-manual-de-marca.pdf`).

## En una frase

**Celeste y blanco con un solo ámbar**, porteña y gastronómica: el cielo de
Buenos Aires, el papel de la comanda y el filete de los carteles de bodegón.

## Reglas

1. **Una idea por sección** en la landing: título y una cosa. Sin subtítulos,
   etiquetas ni textos grises que repitan la imagen. Vale también para lo que
   se anima: un solo movimiento por sección (Julieta, 2026-11-13: "llamativa
   pero clara").
2. **Un solo ámbar por pantalla** (`--color-primary` `#D97706`, letra en
   tinta): la acción principal. Links, chips, avatares, íconos de rubro y
   pestaña activa van en celeste con azul hondo `#1C5478`.
3. **La marca es una sola: el «oído» en Shrikhand**, gorda e inclinada como la
   letra fantasía del fileteado (desde el 2026-11-17; antes Sancreek, que se
   iba al Far West y se parecía a la letra de Bachero). Fileteada en
   `components/landing/Filete.tsx`:
   - `firma` (con adornos finos dorados): pantalla de inicio;
   - el final de la landing: la palabra grande, cortada por el borde, con el
     Sol de Mayo saliendo detrás, sobre un domo de cielo que sube desde el
     borde (degradado radial, sin franjas) y con el pie encima, sobre blanco
     (como el cierre de coofounder). A ese tamaño va sin la sombra beige y
     con menos relieve (`Letras` con `sombra={false}`);
   - en el **encabezado de la landing y de la app** va la misma letra, **plana
     y en azul hondo** (`.landing-marca` desde el 2026-11-13; `components/Logo.tsx`
     desde el 2026-11-17, celeste en oscuro): con el relieve y el dorado
     chocaba con el resto, que es liso. El fileteado completo se ve una sola
     vez, al cierre;
   - `cinta` («¡Oído!»): la comanda.
   La miniatura para compartir usa la `firma` (`assets/og/filete-oido.png`,
   desde el 2026-10-30).
   No va en ningún otro lugar ni con otra palabra.
4. **El ícono es «oí», provisorio** (desde el 2026-11-17; reemplaza a las
   manos y la oreja, que en chico se parecían al ícono de Bachero): las dos
   primeras letras de la marca, que además dicen «te escuché». Es una
   solución tipográfica mientras se diseña un isotipo propio (Julieta,
   2026-11-17: «hay que hacer uno, no ese genérico»; ver Pendiente). Crema sobre azul hondo
   `#1C5478`. **Fileteado** (relieve azul y canto dorado) en los tamaños
   grandes: app en el celular, Apple, arranque de Android, `public/logo-mark.svg`
   y `logo-maskable.svg`. **Plano** de 48 px para abajo (pestaña, encabezado
   de `/bienvenida`: `logo-mark-chico.svg`), donde el relieve se empasta. En
   **silueta blanca** para el badge de las notificaciones de Android y los
   estados vacíos (`logo-figure.svg`). Los PNG y el `.ico` salen de
   `node scripts/build-icons.mjs`.
5. **Lo que no se hace, para no parecerse a Bachero** (crema, azul francia,
   grabados y un ticket; análisis del 2026-11-17 en el historial): el crema
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
| Landing (2026-11-13; variables `--l-*` en `globals.css`): cielo de arriba a abajo, celeste plano, noche, azul de la marca plana | `#6FB0DF` → `#8CC2E7` → `#B4D8EF` → `#DCEDF7`, `#E2EEF6`, `#0D131A`, `#0F3A5B` | igual (la landing es siempre clara) |
| Filete (desde el 2026-10-23): cara crema, filete interior blanco, borde y relieve azul hondo, canto dorado; adornos finos y Sol de Mayo dorados | `#FFF9DC` → `#F2DC9A`, `#FFFFFF`, `#14456A` / `#1C5478`, `#C98A1A`; oro `#B8801F` `#E2B04A` | igual |

Detalle y contrastes: [`color-system.md`](./color-system.md).

## Tipografía

| Familia | Uso |
|---|---|
| **Young Serif** | Títulos de la landing y de pantalla (desde el 2026-11-16: el medidor marcó la letra neutra de Schibsted Grotesk, que regía desde el 2026-10-18; un solo peso) |
| **Inter** | Texto, botones, inputs |
| **DM Mono** | Rótulos de la comanda, horarios |
| **Shrikhand** | Sólo la palabra «oído», fileteada o plana, y el ícono «oí» (desde el 2026-11-17; antes Sancreek; recorte local de 1,5 KB) |

Detalle: [`typography.md`](./typography.md).

## Piezas propias

La comanda impresa con la cinta «¡Oído!», el mapa «va en camino» sobre
Palermo dibujado, la rueda de fotos del inicio y la miniatura al compartir.

## Pendiente

- **Isotipo propio**, no tipográfico: dibujado para Oído (idealmente por un
  fileteador o un ilustrador), que funcione en 16 px y se distinga del de
  Bachero. Hasta entonces, «oí».
- **Llevar la dirección «con relieve» a la app** (Julieta, 2026-11-17: la sombra
  dura azul hondo del filete como profundidad de la interfaz), pantalla por
  pantalla: [`direccion-relieve.md`](./direccion-relieve.md).
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
`2026-10-19-marca-filete-header`, `2026-10-19-splash-filete`.
