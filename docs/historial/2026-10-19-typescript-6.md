# TypeScript 5 → 6, antes de la beta (7 queda para cuando lo soporte el lint)

**Pedido:** Julieta, 2026-10-19. Dependabot propuso TypeScript 7 (#384). Ella
prefirió subirlo ahora, sin usuarios todavía, y no después de la beta.

**Qué se probó:**

- **TypeScript 7.0.2** sobre el `main` actual:
  - `tsc --noEmit` sin errores;
  - **`npm run lint` falla**: `typescript-eslint` 8.71 no soporta TS 7 (acepta
    `>=4.8.4 <6.1.0`; seguimiento en typescript-eslint#10940).
- **TypeScript 6.0.3**, la versión puente con los mismos cambios de reglas que
  la 7: `tsc` sin errores, lint sin errores, `test:unit` 190/190, `build` y
  `cf:build` OK.

**Qué cambió:**

- `frontend/package.json`: `typescript` pasa de `^5` a `~6.0.3`, con `~`
  para no saltar solo a 6.1, que el lint tampoco acepta. También el lockfile.

**Por qué así:** la 6 deja el código listo para la 7 sin romper el lint ni
los controles del CI. TypeScript sólo corre al armar el sitio: no llega al
navegador.

**Queda abierto:** pasar a TypeScript 7 cuando `typescript-eslint` lo
soporte. Cerrar #384 con esta explicación.
