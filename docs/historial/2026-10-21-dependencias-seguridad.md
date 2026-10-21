# Next.js 16.4.2 y dependencias al día por seguridad

**Pedido:** Julieta, el 2026-10-21: después de los avisos de seguridad de esta
semana, tener todo actualizado, con la seguridad como prioridad.

**Qué cambió:** el usuario no ve nada distinto. Por dentro:

- **Next.js 16.4.0 → 16.4.2** (`frontend/package.json`). La 16.4.1 (14/10) es
  un release de seguridad con tres avisos: dos RCE críticos (GHSA-673q-mjm6-r5xr,
  `use cache` que devuelve typed arrays; GHSA-2464-fhr4-w9xw, optimizador de
  imágenes con SVG) y un DoS alto con Server Actions (GHSA-p3m5-59mp-jv5r).
  Oído no usa `use cache` ni Server Actions, y no habilita SVG en el
  optimizador, así que no estaba expuesto. Se sube igual para cerrar la
  puerta. `npm audit` no lo marcaba: esos avisos todavía no estaban en su base.
- **React y React DOM 19.3.0 → 19.3.1**, `eslint-config-next` 16.3.1 → 16.4.2
  (va con la versión de Next).
- **OpenNext 1.20.10 → 1.20.13** (`@opennextjs/cloudflare`). La 1.20.13 pide
  `next >=16.4.1`. El parche de `frontend/scripts/patch-opennext.mjs` sigue
  haciendo falta: su patrón todavía no incluye `preview-props.json`.
- **Lockfile al día dentro de los rangos** (`npm update`): Sentry 10.76.2,
  Vite (dev, aviso alto de `launch-editor` en 8.2.0–8.2.2), Vitest, Playwright,
  wrangler, maplibre-gl, lucide-react, motion 13.5.1 y tipos.
- **Backend** (`backend/requirements.txt`): fastapi 0.157.0 (arrastra starlette
  1.9.0), uvicorn 0.54.0, pydantic 2.14.1, pydantic-settings 2.16.1, asyncpg
  0.32.0, sentry-sdk 2.72.0.
- `npm audit` y `pip-audit`: 0 vulnerabilidades después del cambio.

**Por qué así:** sólo parches y versiones menores, que no cambian cómo se usa
cada librería. Las mayores (ver abajo) se dejaron afuera para que este PR sea
chico y fácil de revertir.

**Queda abierto:** las mayores, que piden su propio PR: SQLAlchemy 2.1,
bcrypt 5 (no anda con `passlib`, que está sin mantenimiento desde 2020),
Sentry 11, motion 14, supercluster 9, TypeScript 7, ESLint 10.
