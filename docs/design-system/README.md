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

v5.0 supersede el rebrand ámbar (#315–#325) y el pivot "lienzo blanco" del
mismo día. La marca pasa a **coral** sobre un **lienzo cálido off-white**, con
un **acento violeta** para lo nuevo, tipografía **Saans / Inter / DM Mono**, y
un **modo oscuro real** (el lienzo se oscurece, ya no es el híbrido anterior).

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
| `motion.md` | ⏳ pendiente (tokens `--motion-*` ya en globals) |
| `accessibility.md` | ⏳ pendiente |
| `ux-principles.md` | ⏳ pendiente |

## Orden de trabajo (no negociable)

**Identidad → Sistema → Componentes → Pantallas.** Nunca al revés. v5.0 entregó
identidad + sistema (tokens de color, tipografía, formas, elevación, modo
oscuro). Los componentes (variantes de card, mapa, feed con ritmo) y las
pantallas vienen después, cada uno como su propio PR verificado.
