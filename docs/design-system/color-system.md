# Color System — Oído v5.0

> Valores en código: `frontend/app/globals.css`. Contrastes WCAG medidos con
> script reproducible: `docs/design/COLOR_SYSTEM.md` (§Verificación). Este doc
> es el mapa semántico: qué token es cada cosa y cuándo usarlo.

## Regla de oro

**El color de marca NO va en todos lados.** El ámbar construye jerarquía: marca
la acción principal y lo urgente. El verde bosque levanta superficies
destacadas; manteca y cielo, datos de apoyo. Todo lo demás es blanco cálido y
tinta. Un acento por contexto.

## Brand

**El naranja es el ámbar de Oído de siempre** (`#D97706`). Se probaron coral
`#FF5A3D` y terracota `#E5531E`; Julieta rechazó ambos ("anaranjado fuerte, me
gusta más el de Oído que ya veníamos usando"). La dirección fijada: **lienzo más
blanco, y el color para acentos y para "levantar", con criterio** — como las
pantallas del board. Suma verde bosque como secundario editorial; manteca
(buttercream) y cielo (baby blue) quedan como acentos suaves.

| Token | Valor (claro) | Uso |
|---|---|---|
| `--color-primary` | `#D97706` | Ámbar. Relleno del botón principal, pin activo, badge Urgente. Con texto **oscuro** (`text-night`, 6.61); el blanco sobre ámbar da 2.86 y falla. |
| `--color-primary-strong` | `#B45309` | Hover/pressed. |
| `--color-primary-text` | `#B45309` (claro) / `#E8920F` (oscuro) | Ámbar como **texto** (precio, links). 4.77 sobre el blanco cálido. |
| `--color-primary-tint` | `#FFFBEB` | Tinte ámbar: fondo de acción/activo, pill de nav, badge. |
| `--color-secondary` | `#1B3A31` | **Verde bosque** editorial (tarjeta "Turnos activos"). Superficie destacada con texto claro. Distinto de `success`. |
| `--color-secondary-tint` / `-text` | `#E6EFE9` / `#1B3A31` | Superficie pálida y texto del verde bosque. |
| `--color-accent` | `#A78BFA` | Violeta. **Fuera de la paleta final**: queda definido para no romper nada, no usar en pantallas nuevas. |
| `--color-accent-tint` / `-text` | `#EDE9FE` / `#6D47D9` | Superficie y texto del acento. |

## Surfaces (jerarquía, no "todo card blanca")

Escala en **claro**: lienzo → tarjeta (elevada) → superficie recesada → foco.

| Token | Claro | Oscuro | Qué es |
|---|---|---|---|
| `--background` | `#FBFAF6` | `#17130F` | Lienzo de la app (blanco cálido / warm near-black). |
| `--color-card` | `#FFFFFF` | `#221D18` | La tarjeta. Flota por elevación (hairline + sombra en claro; luminancia en oscuro). |
| `--color-surface` | `#F3EFE6` | `#2B251F` | Recesado: chips, tracks, inputs idle. |
| `--color-chrome` | `#FFFFFF` | `#1B1611` | Nav/header. En oscuro también se oscurece. |
| `--color-focus` | `#111111` | `#3D3630` | Módulo de foco (ganancias, pago): la masa de máxima jerarquía. |

## Text

| Token | Claro | Uso |
|---|---|---|
| `--color-ink` | `#111111` | Text primario. |
| `--color-ink-soft` | `#4B5563` | Secundario (metadata, subtítulos). |
| `--color-ink-mute` | `#7C8A9A` | Muted (fine print, placeholders). |

*(Los usos existentes de `text-ink/60`, `text-ink/40` — alpha del primario —
siguen válidos; los tokens soft/mute son la versión nombrada del board.)*

## Status

| Familia | Base | -tint | -text (claro) | Uso |
|---|---|---|---|---|
| success | `#16A34A` | `#F0FDF4` | `#15803D` | Disponible, confirmado, éxito. |
| warning | `#F59E0B` | `#FFFBEB` | `#92660A` | Cerca del límite, atención. |
| danger | `#EF4444` | `#FEF2F2` | `#D73D3D` | Error, cancelado, no-show. |
| info | `#3B82F6` | `#DBEAFE` | `#1D4ED8` | Informativo, "va en camino", tips. |

## Modo oscuro

Es un **modo oscuro real** (v5.0): el lienzo se oscurece, no sólo las tarjetas
(supersede el híbrido anterior). La jerarquía la da la **luminancia**: lienzo
`#17130F` → card `#221D18` → surface `#2B251F` → focus `#3D3630`. Ámbar y
verde bosque se mantienen como acentos (aclarados para AA como texto); texto y
bordes van claros. Los `-text` se recalculan para el fondo oscuro en el bloque
`:root[data-theme="dark"]` de `globals.css`.

**Regla del par tint/text en oscuro:** todo token que tenga un `-text` que se
aclara en oscuro necesita también su `-tint` oscuro (un velo del propio color,
`rgba(…, 0.14–0.18)`), o el chip queda con texto claro sobre fondo pálido. Lo
mismo `--color-line`: si no se redefine, los bordes quedan con el hairline
claro de `:root`. Manteca y cielo también siguen la regla desde el
2026-09-23: antes eran "pares auto-contenidos" iguales en los dos modos, y se
leían, pero en el oscuro real eran bloques pálidos que brillaban sobre la
tarjeta oscura (la tarjeta de nivel del perfil, los íconos de estadísticas).
Ahora en oscuro son un velo del color con el color base como texto.

## Chip de ícono (`IconChip`)

Un ícono de contenido (una fila de menú, un dato de un turno, un encabezado
de campo) va sobre un chip de color suave: `components/ui/IconChip.tsx`. Nació
en las estadísticas del perfil y desde el 2026-09-27 es uno solo para toda la
app, porque Julieta vio que en el resto de las pantallas el mismo tipo de
ícono iba en gris sobre gris. El tono dice qué es el dato y se repite igual en
todas las pantallas:

| Tono | Significa | Ejemplos |
|---|---|---|
| `cielo` | Tiempo y comunicación | Cuándo, notificaciones, soporte, años de experiencia |
| `trust` | Lugar y fiabilidad | Dónde, ubicación, verificación, cancelaciones |
| `manteca` | Personas y trabajo | Puesto, turnos, cantidad de personas |
| `secondary` | Plata | Pago, mi plan |
| `danger` | Sólo favoritos | El corazón |
| `primary` | El acento de la pantalla | Usar poco: sigue la regla de un solo ámbar |
| `neutral` | Acciones que no son contenido | Cerrar sesión |

Los botones de control (atrás, cerrar, flechas del mazo) no llevan chip de
color: son herramientas, no datos. Todos los tonos usan pares tint/text que
`globals.css` redefine para oscuro (ver la regla de arriba).

## Toast y `night` en oscuro

`--color-night`/`bg-night` es near-black en los dos modos por diseño (burbujas
propias del chat, badges sobre foto). El **toast** ya no lo usa: tiene su par
`--color-toast`/`--color-toast-ink`, que en claro es el mismo negro y en
oscuro se **invierte** (crema `#F5F1EA` con tinta `#17130F`), porque un toast
casi negro sobre el lienzo oscuro no se distinguía del fondo.

## Tono de banner por rubro

`SKILL_HERO_TONE` (`lib/skill-style.tsx`): el banner de una tarjeta de turno
sin foto es un tono **profundo y plano** por rubro (petróleo, espresso, pizarra,
ciruela…; el mozo lleva el verde bosque de la marca). Reemplaza al gradiente
saturado: sigue distinguiendo dos turnos seguidos sin competir con el ámbar.
Ningún rubro usa un matiz rojo: el bartender pasó de rojo a borgoña y de
borgoña a petróleo (`#173f4c`, 2026-09-25) porque cualquier rojo se lee como
el color de error.

## Propuesta v6: celeste y naranja (en prueba, 2026-10-09)

Historia corta: el 2026-10-08 Julieta pidió pasar el verde bosque a un
degradé violeta (`#5c22cf` → `#8e69d8`), el ámbar `#d97706` a `#ffab25` y la
crema a `#f3f3f3`, y eligió que sea la paleta de **toda la app**, probándola
primero en la landing. El 2026-10-09 cambió el violeta por el celeste claro
y el naranja de una referencia suya (paneles celestes, letra y botones
naranja): eligió el celeste claro `#c4e3ed` y, en una tarjeta de decisión,
el naranja `#e64c1e` para los botones. Descartó también el petróleo.

Es un bloque de tokens (`[data-palette="celeste"]` en `globals.css`,
prendido sólo en la raíz de la landing) y no colores sueltos: para llevarla
a la app, ese bloque pasa a `:root` y se arma su versión oscura. **Hasta que
Julieta lo apruebe, las tablas de arriba (v5.0) siguen siendo las vigentes
en la app.** El PDF del design system de `/mnt/project-files/design-system/`
documenta la versión violeta; no se rehízo.

| Token | v5.0 | v6 | Nota |
|---|---|---|---|
| `--background` | `#FBFAF6` | `#C4E3ED` | El celeste claro es el lienzo: el color que domina. Tinta 13,99. |
| `--color-primary` | `#D97706` | `#E64C1E` | Siempre con tinta encima (4,87). Blanco da 3,88: no. Nunca como letra (2,87 sobre el celeste). |
| `--color-primary-text` | `#B45309` | `#1C5478` | Texto destacado en azul hondo: 6,01 sobre el celeste, 8,11 sobre blanco. |
| `--color-secondary` | `#1B3A31` | `#1C5478` | Azul hondo: el celeste oscurecido. Lleva la letra blanca (8,11). |
| `--gradient-brand` | — | `none` | `bg-brand` queda liso en azul hondo (ver abajo). |
| `--color-surface` / `--color-paper` | `#F3EFE6` | `#B5DAEB` | El celeste con 35% de `#9ac9e7`. Tinta 12,76. También el mapa. |
| `--color-line` | varios | `#9CC8DB` | |
| los `-tint` | varios | `#DDEEF4` | |
| `--color-accent` | `#A78BFA` | `#9AC9E7` | El celeste más fuerte de la referencia. |
| `--color-manteca` | `#F1E7A0` | `#C4E3ED` | Dato sobre oscuro: 6,01 sobre el azul hondo, 13,48 sobre la noche. |
| `--color-ink-mute` | `#7C8A9A` | `#4F5960` | 5,31 sobre el celeste, 4,84 sobre el recesado, 7,17 sobre blanco. |
| `--color-night` | `#191410` | `#121619` | Negro frío. El naranja encima da 4,69. |

Reglas que salieron de medir:

- **Las superficies con letra blanca no pueden ser el celeste.** El banner
  del mozo, la tarjeta "Recomendado", el reloj cubierto y el resultado van
  en azul hondo liso (`#1c5478`): blanco 8,11, al 85% 6,37, al 75% 5,36.
- **Sin brillo en el degradé.** Un brillo celeste (`#2c85bc`, el que daría
  4,07 con blanco) tiene la misma luminancia que el naranja (1,04): el botón
  naranja vibraría encima. Por eso `--gradient-brand: none`.
- El botón secundario sobre el azul hondo lleva borde blanco al **60%**, como
  lo pidió Julieta (4,07; un borde pide 3:1). Con el violeta había quedado en
  80% porque el brillo bajaba el 60% a 2,48.
- La letra chica sobre la banda naranja del "¡Oído!" va en tinta llena
  (4,87); al 70% daba 3,40.
- El anillo de foco es azul hondo sobre claro (6,01), naranja sobre la noche
  (4,69), blanco sobre el azul hondo y tinta sobre la banda naranja
  (`--focus-ring`).
- El naranja queda a 14° del rojo de error (`#d73d3d`): un error va siempre
  con ícono y texto, nunca sólo con color.
- La inicial de los avatares sin foto va en tinta: en el centro del degradé
  naranja da 4,45 contra 4,09 del blanco (es letra grande: pide 3:1).

