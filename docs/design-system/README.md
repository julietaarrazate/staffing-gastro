# Design System de Oído — v5.0 "sistema de identidad"

> Creado 2026-09-20 a partir del board de diseño definitivo que pasó Julieta
> (dos tableros: style-guide + pantallas). Esta carpeta documenta las REGLAS
> del sistema — cuándo y por qué usar cada cosa —, no sólo los valores.
> La fuente de verdad **en código** es `frontend/app/globals.css`; la de color
> con contrastes medidos sigue siendo `docs/design/COLOR_SYSTEM.md`.

## Qué es Oído, visualmente

Un **marketplace de hospitality con sensibilidad editorial y personalidad
social** — no un portal de empleo, un dashboard SaaS ni una fintech. La
gramática visual combina:

- **Disciplina sistémica** (todo pasa por tokens; coherencia entre pantallas).
- **Marketplace + descubrimiento** (feed, mapa, perfiles, favoritos).
- **Hospitality editorial** (fotografía de locales, calidez, composición).
- **Personalidad social** (el contenido — un turno — es una *oportunidad*, no
  un registro de base de datos).

## El pivot de v5.0 (qué cambió y por qué)

v5.0 (#345) mantiene el **ámbar de Oído `#D97706`** como único acento de
acción, sobre un **lienzo cálido off-white** `#FBFAF6`, con **verde bosque**
`#1B3A31` como superficie destacada, tipografía **Fraunces / Inter / DM Mono**
y un **modo oscuro real** (el lienzo se oscurece, ya no es el híbrido
anterior).

> **Corrección 2026-09-26.** Este párrafo decía que la marca "pasa a coral",
> con un acento violeta y tipografía Saans. Era el borrador del board, no lo
> que se aprobó: el coral y el terracota se probaron y Julieta los rechazó,
> Saans es paga y no se licenció, y el violeta quedó fuera de la paleta final
> (el token `--color-accent` existe para no romper nada, pero no se usa en
> pantallas nuevas). La fuente de verdad es `color-system.md` y
> `typography.md`.

## Índice

| Doc | Estado |
|---|---|
| [`brand-foundation.md`](./brand-foundation.md) | ✅ v5.0 |
| [`color-system.md`](./color-system.md) | ✅ v5.0 (detalle WCAG en `docs/design/COLOR_SYSTEM.md`) |
| [`typography.md`](./typography.md) | ✅ v5.0 |
| [`shape-language.md`](./shape-language.md) | ✅ v5.0 |
| [`elevation.md`](./elevation.md) | ✅ v5.0 |
| `spacing.md` | ⏳ pendiente (escala 4px ya en uso vía Tailwind) |
| `iconography.md` | ⏳ pendiente (Lucide; auditoría en el pase de componentes) |
| `components.md` | ⏳ pendiente (pase de componentes: ShiftCard/VenueCard/WorkerCard…) |
| [`motion.md`](./motion.md) | ✅ reglas + piezas (2026-09-23) |
| `accessibility.md` | ⏳ pendiente |
| `ux-principles.md` | ⏳ pendiente |

## Orden de trabajo (no negociable)

**Identidad → Sistema → Componentes → Pantallas.** Nunca al revés. v5.0 entregó
identidad + sistema (tokens de color, tipografía, formas, elevación, modo
oscuro). Los componentes (variantes de card, mapa, feed con ritmo) y las
pantallas vienen después, cada uno como su propio PR verificado.
