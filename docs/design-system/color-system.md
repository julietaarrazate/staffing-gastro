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
| `--color-accent` | `#A78BFA` | Violeta. **No es acción**: marca lo "nuevo"/descubrimiento. |
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
claro de `:root`. Excepción: manteca y cielo son pares auto-contenidos (su
texto no se aclara) y se quedan igual en los dos modos.

## Toast y `night` en oscuro

`--color-night`/`bg-night` es near-black en los dos modos por diseño (burbujas
propias del chat, badges sobre foto). El **toast** ya no lo usa: tiene su par
`--color-toast`/`--color-toast-ink`, que en claro es el mismo negro y en
oscuro se **invierte** (crema `#F5F1EA` con tinta `#17130F`), porque un toast
casi negro sobre el lienzo oscuro no se distinguía del fondo.

## Tono de banner por rubro

`SKILL_HERO_TONE` (`lib/skill-style.tsx`): el banner de una tarjeta de turno
sin foto es un tono **profundo y plano** por rubro (vino, espresso, pizarra,
ciruela…; el mozo lleva el verde bosque de la marca). Reemplaza al gradiente
saturado: sigue distinguiendo dos turnos seguidos sin competir con el ámbar.
