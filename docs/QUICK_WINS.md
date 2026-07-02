# QUICK_WINS.md — Mejoras de bajo costo / alto valor (Fase 0)

> Cambios acotados, de bajo riesgo y alto impacto, extraídos de
> [TECH_DEBT.md](./TECH_DEBT.md). Ordenados por relación valor/esfuerzo. Cada uno
> debería ser un PR chico y verificable. **No** requieren decisiones grandes.

## Seguridad (rápidas y críticas)

1. ✅ **HECHO — Fallar el arranque si `jwt_secret_key` es el default en
   producción.** `Settings._reject_insecure_defaults` rechaza el valor por
   defecto cuando `environment == "production"`. *(esfuerzo: bajo · impacto: alto)*
2. ✅ **HECHO — Rate limit en `/auth/login` (10/min) y `/auth/register`
   (5/min).** En memoria (`app/core/rate_limit.py`), configurable con
   `RATE_LIMIT_ENABLED`. *(bajo · alto)*
3. ✅ **HECHO — Security headers** vía `SecurityHeadersMiddleware`
   (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
   `Permissions-Policy`, HSTS en producción). *(bajo · medio)*

## Frontend / Design System (cierre de deuda de diseño)

4. ✅ **HECHO — EmptyState unificado.** Los 6 usos de `PageState` migraron al DS
   (`ui/EmptyState`, `ui/ErrorBanner` y `ui/CardSkeletons` nuevos) y
   `PageState.tsx` fue **eliminado**. *(medio · alto)*
5. ✅ **HECHO — `SKILL_STYLES` eliminado.** `search`, `shifts/new` y
   `workers/[id]` migraron a `SKILL_ACCENT`; cerrada la transición
   monocromática. *(medio · alto)*
6. ✅ **HECHO (casos claros) — Botones inline → `Button`** en login, register,
   formularios de perfil y ReviewBox. Quedan a propósito los controles con
   estilo genuinamente único (gestos de swipe, controles de mapa, iconos
   puros). *(medio · medio)*

## Backend / tests

7. ✅ **HECHO — Helpers compartidos en `tests/conftest.py`**
   (`register_user`, `login`, `auth_headers`): eliminada la duplicación en los
   11 archivos de test. *(bajo · medio)*
8. ✅ **HECHO — Seed limpio:** eliminado el campo `logo_url` muerto de
   `COMPANIES`. *(bajo · bajo)*

## Producto / claridad

9. **Marcar explícitamente lo pendiente en la UI** donde hoy se muestra vacío por
   falta de lógica (p. ej. insignias/niveles), para no confundir "no tiene" con
   "no implementado". *(bajo · bajo)*

## Cómo abordarlos

- Priorizar **1–2 (seguridad)** y **4–5 (cierre de diseño)**: máximo valor.
- Cada quick win: PR chico, `pytest -q` / `tsc` + `build` verdes, doc actualizada
  si corresponde.
- Los ítems 4, 5 y 6 encajan naturalmente en la **Fase 4 (Refactor)** y **Fase 5
  (Design System)** del master plan; los de seguridad en la **Fase 9**, pero por
  su bajo costo/riesgo pueden adelantarse con autorización.
