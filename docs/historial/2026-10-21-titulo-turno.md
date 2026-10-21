# Título del turno sin "— Oído — Oído"

**Pedido:** visto el 2026-10-19 al medir la caché de `/turno/[id]`; Julieta
pidió avanzar con lo pendiente que más aporte.

**Qué pasaba:** la pestaña y la vista previa del link decían "Buscamos
Cocinero/a en … — Oído — Oído". La página ya armaba el título con "— Oído"
(igual que `og:title`) y la plantilla del layout (`%s — Oído`) le sumaba otro.

**Qué cambió:** `frontend/app/turno/[id]/page.tsx` usa `title: { absolute }`
para el turno, y "Turno no encontrado" va sin la marca para que la plantilla
la agregue una sola vez.

**Cómo se verificó:** `tsc` y `eslint`. No hay test de este título; la página
es SSR contra la API real, así que se mira en producción después del merge.
