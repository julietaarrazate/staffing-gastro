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

4. **Unificar EmptyState/encabezados**: migrar los ~6 usos de `PageState` al DS
   (`components/ui`) y **borrar `PageState.tsx`**. Elimina un sistema duplicado.
   *(medio · alto)*
5. **Migrar los 3 usos restantes de `SKILL_STYLES` a `SKILL_ACCENT`** (`search`,
   `shifts/new`, `workers/[id]`) y **eliminar `SKILL_STYLES`**: cierra la
   transición monocromática. *(medio · alto)*
6. **Reemplazar botones inline por `Button`** del DS (empezar por las pantallas
   con más usos). *(medio · medio)*

## Backend / tests

7. **Extraer `_auth_headers` (y helpers de registro) a `tests/conftest.py`**:
   borra duplicación en ~18 archivos de test. *(bajo · medio)*
8. **Limpiar dato muerto en el seed:** el campo `logo_url` hardcodeado en
   `COMPANIES` quedó sin uso tras computar la foto por categoría. *(bajo · bajo)*

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
