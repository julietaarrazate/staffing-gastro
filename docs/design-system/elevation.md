# Elevation — Oído v5.0

La profundidad indica **prioridad, interacción y separación** — no decora.

## Claro: sombra + hairline

Sobre el lienzo off-white, la tarjeta blanca flota por **hairline (`--line`) +
sombra suave**. Tokens en `globals.css`:

| Nivel | Token | Uso |
|---|---|---|
| Flat | — (sólo hairline) | Elementos que separan por borde, no por sombra. |
| Subtle / Elevated | `--shadow-soft` | Card base. Dos capas: contacto 1px + ambiente. |
| Floating | `--shadow-float` | Sheets, modales, elementos sobre el mapa. |

Los glows semánticos (`--shadow-primary/-success/-danger`) proyectan el color
de la acción, no una sombra neutra — se derivan del token con `color-mix()`,
así que siguen al color solo (ya no hay rgb horneado por componente).

## Oscuro: luminancia, no sombra

En el modo oscuro real de v5.0 no hay luz que proyectar: la jerarquía la da la
**luminancia**. Cada escalón sube de brillo: lienzo `#17130F` → card `#221D18`
→ surface `#2B251F` → focus `#3D3630`, más una hairline clara al 12%. Las
sombras siguen presentes pero secundarias.

## Regla

No usar sombra por estética. Si dos superficies necesitan distinguirse y no hay
relación de profundidad real (una encima de otra), separalas por color/hairline,
no por sombra.
