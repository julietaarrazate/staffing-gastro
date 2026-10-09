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

## Propuesta v6: paleta violeta (en prueba, 2026-10-08)

Pedido de Julieta: el verde bosque pasa a un degradé `#5c22cf` → `#8e69d8`,
el ámbar de acción `#d97706` pasa a `#ffab25`, la crema y la manteca pasan a
`#f3f3f3` y parecidos, y los niveles nuevos salen de la gama entre `#f3f3f3`
y `#8e69d8`. Eligió que sea la paleta de **toda la app**, probándola primero
en la landing. Por eso es un bloque de tokens (`[data-palette="violeta"]` en
`globals.css`, prendido sólo en la raíz de la landing) y no colores sueltos:
para llevarla a la app, ese bloque pasa a `:root` y se arma su versión
oscura. **Hasta que Julieta lo apruebe, las tablas de arriba (v5.0) siguen
siendo las vigentes en la app.** El documento completo, con cada par medido,
es el PDF del design system (`/mnt/project-files/design-system/`).

| Token | v5.0 | v6 | Nota |
|---|---|---|---|
| `--color-primary` | `#D97706` | `#FFAB25` | Siempre con tinta encima (9,98). Blanco da 1,89: prohibido. |
| `--color-primary-text` | `#B45309` | `#5C22CF` | El ámbar como texto sobre claro da 1,70; el texto destacado va en violeta (7,32). |
| `--color-secondary` | `#1B3A31` | `#5C22CF` | Liso en lo chico (píldoras, el reloj cubierto). |
| `--gradient-brand` | — | radial, ver abajo | Superficies grandes, con la utilidad `bg-brand`. |
| `--background` | `#FBFAF6` | `#F3F3F3` | |
| `--color-surface` / `--color-paper` | `#F3EFE6` | `#E9E5F0` | 10% de la gama. |
| `--color-line` y los `-tint` | varios | `#E4DEEF` | 15% de la gama. |
| `--color-manteca` | `#F1E7A0` | `#D5CAEB` | 30% de la gama: datos sobre violeta (5,21) u oscuro (12,0). |
| `--color-ink-mute` | `#7C8A9A` | `#686572` | 5,12 sobre el lienzo; el anterior daba 3,18. |
| `--color-night` | `#191410` | `#141118` | Neutro con un toque violeta. |

La gama es una mezcla **sRGB** de `#f3f3f3` hacia `#8e69d8`; así salen
exactos los tres tokens.

**El degradé es un brillo en la esquina, no una diagonal:**
`radial-gradient(110% 80% at 100% 100%, #8e69d8 0%, #6c3bd1 50%, #5c22cf 100%)`.
El blanco da 8,12 sobre `#5c22cf`, 6,60 sobre `#6c3bd1` y 4,07 sobre
`#8e69d8`. En estas superficies el texto arranca arriba a la izquierda y el
botón o el ícono suelen ir abajo a la derecha, donde está el brillo. Con una
diagonal de 155° la letra chica blanca caía en la punta clara (3,4 a 4,0).
Medido texto por texto (las cuatro esquinas y el centro de cada caja de
texto, con las capas semitransparentes compuestas), ningún texto sobre el
degradé baja de 4,5 a 390×844 ni a 1440×900. Eso incluye las tarjetas que
pintan el degradé en una capa al lado del texto y no detrás (`OpportunityCard`,
`ShiftCard`), que se midieron aparte con píxeles reales: ahí la distancia de
la tarjeta del turno, en blanco al 70%, daba 3,98 y pasó al 85% (5,09). `bg-brand` sin la paleta
violeta es el verde bosque liso de siempre, así que la app no cambia.

Reglas que salieron de medir:

- El botón secundario sobre el degradé lleva borde blanco al **80%** (3,2 en
  el brillo); al 60% daba 2,48. Sobre la noche, 60% alcanza (7,19).
- El anillo de foco es violeta `#5c22cf` sobre claro (7,32), `#ffab25` sobre
  la noche (9,89), blanco sobre el violeta y tinta sobre la banda ámbar
  (`--focus-ring`). Sobre el violeta el ámbar daba 4,30 en `#5c22cf` pero
  2,15 en el brillo `#8e69d8`, donde caen los botones del resultado en el
  celular; el blanco no baja de 4,07.
- La inicial de los avatares sin foto (`Avatar`, `WorkerMarker`) va en
  tinta y no en blanco. En el centro del degradé del avatar, con el ámbar
  nuevo, el blanco da 2,06 y la tinta 9,19. Este cambio ya vale en toda la
  app, y también mejora el ámbar de v5.0: ahí el blanco daba 3,99 (no
  llegaba) y la tinta da 4,74.
