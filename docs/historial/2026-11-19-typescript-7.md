# TypeScript 7 chequea los tipos; ESLint y `next build` siguen con la 6 (#681)

**Pedido:** Julieta, 2026-11-17 (etapa 5 de la salida a beta) y 2026-11-19: «Hacé el PR de TypeScript 7». Lo decidido: subir de 6 a 7 y correr tsc, lint, build y e2e; si ESLint con tipos se traba hasta la 7.1, ESLint sigue con TypeScript 6 mientras tanto.

**Qué se probó (TypeScript 7.0.2, la estable):**
- **`tsc --noEmit` con la 7: sin errores, 2,0 s contra 12,8 s de la 6** (2.850 archivos; un error puesto a propósito lo detecta y sale con código 1).
- Con la 7 como `typescript` principal pasan `test:unit` (984), `next build` (Next 16.4 chequea tipos con la 7 en 3 s) y `cf:build`. **Falla el lint:** «typescript-eslint does not support TS 7.0». typescript-eslint 8.73 (la última) acepta `typescript` <6.1 y la 7 recién desde la 7.1 (hoy en beta), instalada aparte como `@typescript/native`. El paquete 7.0 ya no trae la API de JavaScript de siempre (`require("typescript")` sólo da la versión).
- Darle la 6 sólo a ESLint con `overrides` de npm no anda: npm no los aplica a las dependencias «peer» y ESLint sigue viendo la 7.

**Qué cambió:**
- `frontend/package.json`: `typescript-7` (alias de `typescript@~7.0.2`) y el script `npm run typecheck`, que corre su `tsc`. `typescript` queda en `~6.0.3` para typescript-eslint, `next build` y el editor.
- CI (`.github/workflows/ci.yml`): el paso de tipos corre `npm run typecheck` (TypeScript 7).
- Dependabot: no propone la 7 ni la 6.1 para `typescript` (la 6.0 que necesita ESLint: typescript-eslint acepta <6.1); `typescript-7` se actualiza normal (hallazgo de la revisión independiente).
- Docs: `CLAUDE.md`, `TESTING.md`, `PRINCIPLES.md`, `ARCHITECTURE.md` y una receta en `SESION_CLOUD.md` («`npm run typecheck`, no `npx tsc`»: con dos versiones instaladas, `npx tsc` puede ser cualquiera de las dos).

**Por qué así:** es lo que decidió Julieta y el mismo arreglo que prepara typescript-eslint para la transición: la 6 como `typescript` para quien usa su API y la 7 al lado. La 7 chequea los tipos en CI; ESLint y `next build` siguen con la 6, que es la misma API de siempre. Se descartó como principal la 7 con un parche a la carga de módulos de Node para engañar a ESLint: usa una API interna de Node y se rompe sin avisar. No cambia nada para los usuarios: TypeScript no llega al navegador.

**Queda abierto:** pasar del todo a la 7 apenas typescript-eslint la acepte en una versión estable (hoy sólo la 7.1 beta, como `@typescript/native`). Cómo darse cuenta y los pasos exactos están en `docs/STATUS.md`, ítem 5 («Pasar del todo a TypeScript 7»), y en el comentario de la regla de `.github/dependabot.yml`.
