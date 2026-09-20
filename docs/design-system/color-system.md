# Color System — Oído v5.0

> Valores en código: `frontend/app/globals.css`. Contrastes WCAG medidos con
> script reproducible: `docs/design/COLOR_SYSTEM.md` (§Verificación). Este doc
> es el mapa semántico: qué token es cada cosa y cuándo usarlo.

## Regla de oro

**El color de marca NO va en todos lados.** El coral construye jerarquía: marca
la acción principal y lo urgente. El violeta marca lo nuevo/descubrimiento.
Todo lo demás son superficies neutras cálidas y tinta. Un acento por contexto.

## Brand

Terracota (board 2, muestreo de píxeles). Reemplaza el coral `#FF5A3D`, que
Julieta rechazó por "anaranjado fuerte": el board usa un burnt-orange más cálido
y terroso. Suma verde bosque como secundario editorial.

| Token | Valor (claro) | Uso |
|---|---|---|
| `--color-primary` | `#E5531E` | Terracota. Relleno del botón principal, pin activo, badge Urgente. Con texto **blanco** (4.4 = AA grande). |
| `--color-primary-strong` | `#C6440F` | Hover/pressed. |
| `--color-primary-text` | `#AD420D` (claro) / `#F0774A` (oscuro) | Terracota como **texto** (precio, links). Oscurecido en claro para AA. |
| `--color-primary-tint` | `#FBE8DA` | Peach cálido: fondo de acción/activo, pill de nav, badge. |
| `--color-secondary` | `#1B3A31` | **Verde bosque** editorial (tarjeta "Turnos activos"). Superficie destacada con texto claro. Distinto de `success`. |
| `--color-secondary-tint` / `-text` | `#E6EFE9` / `#1B3A31` | Superficie pálida y texto del verde bosque. |
| `--color-accent` | `#A78BFA` | Violeta. **No es acción**: marca lo "nuevo"/descubrimiento. |
| `--color-accent-tint` / `-text` | `#EDE9FE` / `#6D47D9` | Superficie y texto del acento. |

## Surfaces (jerarquía, no "todo card blanca")

Escala en **claro**: lienzo → tarjeta (elevada) → superficie recesada → foco.

| Token | Claro | Oscuro | Qué es |
|---|---|---|---|
| `--background` | `#F8F6F1` | `#17130F` | Lienzo de la app (off-white cálido / warm near-black). |
| `--color-card` | `#FFFFFF` | `#221D18` | La tarjeta. Flota por elevación (hairline + sombra en claro; luminancia en oscuro). |
| `--color-surface` | `#F1ECE6` | `#2B251F` | Recesado: chips, tracks, inputs idle. |
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
`#17130F` → card `#221D18` → surface `#2B251F` → focus `#3D3630`. Coral y
violeta se mantienen como acentos (aclarados para AA como texto); texto y
bordes van claros. El coral relleno y los `-text` se recalculan para el fondo
oscuro en el bloque `:root[data-theme="dark"]` de `globals.css`.

## Pendiente de auditoría en oscuro (pase de componentes)

`--color-night`/`bg-night` (toasts, botón "dark", marcadores) es near-black en
los dos modos por diseño; sobre el lienzo oscuro nuevo queda con poco contraste
— revisar toast y variante `dark` del botón en el pase de componentes.
