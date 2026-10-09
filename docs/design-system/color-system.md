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

## v6: celeste claro (vigente desde 2026-10-09)

Historia corta: el 2026-10-08 Julieta pidió pasar el verde bosque a un
degradé violeta (`#5c22cf` → `#8e69d8`), el ámbar `#d97706` a `#ffab25` y la
crema a `#f3f3f3`, y eligió que sea la paleta de **toda la app**, probándola
primero en la landing. El 2026-10-09 decidió que **todo lo que era violeta
pasa al celeste claro `#c4e3ed`** y el resto queda como en la versión violeta.
Se probaron y descartaron el petróleo y una versión con lienzo celeste y
botones naranja `#e64c1e`.

Es un bloque de tokens en `globals.css` ("PALETA CELESTE") que primero se
prendió sólo en la landing y desde el 2026-10-09 rige en `:root`: **en toda
la app pisa los colores de las tablas de arriba (v5.0)**, que quedan como
historia. El modo oscuro toma el ámbar, el celeste y la noche, y aclara sus
`-text` y `-tint` (tabla de abajo). El PDF del design system de
`/mnt/project-files/design-system/` documenta la versión violeta; no se
rehízo.

| Token | v5.0 | v6 | Nota |
|---|---|---|---|
| `--background` | `#FBFAF6` | `#F3F3F3` | Lienzo neutro, como en la versión violeta. |
| `--color-primary` | `#D97706` | `#FFAB25` | Siempre con tinta encima (9,98). Blanco da 1,89: no. |
| `--color-primary-text` | `#B45309` | `#1C5478` | Azul hondo, el celeste oscurecido: 7,31 sobre el lienzo, 8,11 sobre blanco. |
| `--color-secondary` | `#1B3A31` | `#C4E3ED` | Celeste claro, la superficie de marca. Lleva **tinta** (13,99), no blanco (1,35). |
| `--gradient-brand` | — | `none` | `bg-brand` queda liso. |
| `--color-surface` / `--color-paper` | `#F3EFE6` | `#E5EEF1` | 30% del celeste sobre el lienzo. También el mapa. |
| `--color-line` y los `-tint` | varios | `#DEECF0` | 45% del celeste. |
| `--color-accent` | `#A78BFA` | `#9AC9E7` | |
| `--color-manteca` | `#F1E7A0` | `#C4E3ED` | Dato sobre la noche: 13,85. |
| `--color-ink-mute` | `#7C8A9A` | `#686572` | El de la versión violeta: 4,83 sobre el recesado. Nunca sobre el celeste lleno (4,21). |
| `--color-night` | `#191410` | `#141118` | El de la versión violeta. |

Letra sobre la superficie de marca (`@theme`, con su valor en la paleta):

| Token | De siempre | Celeste | Uso |
|---|---|---|---|
| `--color-on-brand` | blanco | `#111111` | Letra sobre `bg-brand`/`bg-secondary`. Con alfa: al 60% da 4,46 sobre el celeste. |
| `--color-on-brand-label` | `#F1E7A0` | `#1C5478` | Dato destacado (horas del registro, rótulos). 6,01. |
| `--color-on-brand-icon` | `#D97706` | `#1C5478` | Ícono sobre la marca. |
| `--color-brand-veil` | negro 15% | transparente | Velo del banner sin foto. |

En oscuro (`:root[data-theme="dark"]`, sobre el lienzo `#17130F`, la tarjeta
`#221D18` y el recesado `#2B251F`):

| Token | Oscuro | Contraste |
|---|---|---|
| `--color-primary-text` | `#FFAB25` | 9,77 · 8,83 · 8,00 |
| `--color-secondary-text`, `--color-manteca-text` | `#C4E3ED` | 13,69 · 12,38 · 11,22 |
| `--color-accent-text` | `#9AC9E7` | 10,46 · 9,45 · 8,57 |
| los `-tint` | el color al 14–16% | |
| `--focus-ring` | `#FFAB25` | El azul hondo no se ve sobre oscuro. |

La superficie de marca sigue celeste en oscuro, con la letra en tinta.

Reglas que salieron de medir:

- **La letra sobre la marca va en `on-brand`, nunca en `text-white`.** Así
  la misma tarjeta da blanco sobre el verde bosque y tinta sobre el celeste.
  El banner por rubro lo resuelve `heroInk()` (`lib/skill-style.tsx`): con
  foto, siempre blanco.
- **Ninguna sección pasa de la noche a la marca con la letra ya escrita**:
  la tinta no se lee sobre la noche (por eso el resultado ya entra celeste).
- El botón ámbar sobre el celeste se separa poco (1,40:1); su letra en tinta
  sí se lee (9,98). Aceptado por Julieta.
- Ningún relleno ámbar lleva letra blanca (1,89): la splash, la inicial de
  los perfiles sin foto y el botón de ubicación de Buscar van en tinta.
- Los chips `IconChip` de tono `manteca`, `secondary` y `primary` quedaron
  los tres en celeste con azul hondo: se distinguen por el ícono, ya no por
  el color.
- El anillo de foco es azul hondo sobre claro, ámbar sobre la noche y tinta
  sobre el verde bosque y la banda ámbar (`--focus-ring`).
- La inicial de los avatares sin foto va en tinta: sobre el degradé ámbar da
  9,10 contra 2,06 del blanco.
