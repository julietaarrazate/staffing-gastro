# Retro de navegabilidad: STATUS corto, historial por archivo, mapa del código y recetas cloud

**Pedido:** Julieta pidió leer las últimas diez sesiones de agentes y
encontrar dónde tardaban en dar con la información o se apoyaban en docs
desactualizados.

**Qué se encontró, por frecuencia:**

- **`docs/STATUS.md` era el cuello de botella** (9 de 10 sesiones). Tenía
  5.091 líneas, "Qué sigue" estaba en la 4.402 y su título decía "(estado
  vigente al 2026-09-08 — …)", así que el `grep "Qué sigue (estado
  vigente)"` que `CLAUDE.md` sugería caía en un puntero. Cada sesión gastó
  de 4 a 9 llamadas en llegar, y dos no llegaron nunca. Además el bloque
  "Última actualización" del principio, que todos los PRs reescribían,
  generó conflictos de merge en al menos seis PRs entre el 2026-09-24 y el
  2026-10-01. El del #394 dejó el PR un día sin corrida de CI.
- **El entorno cloud se redescubría en cada sesión** (8 de 10): el
  `git worktree add -b` del protocolo falla porque la rama ya existe; pip
  falla contra el Python del sistema; Playwright no encuentra el Chromium
  (la revisión instalada no es la que pide); las capturas se armaban desde
  cero con un script en `/tmp` que se perdía al retomar; `pkill -f "next
  start"` mataba la propia shell; y las páginas SSR salían contra la API de
  producción sin avisar.
- **No había un mapa de qué existe** (5 de 10). Una sesión propuso como
  nuevas dos funciones que Oído ya tenía. Ubicar un dato concreto (el color
  de bartender, las claves de `localStorage`, el panel del comercio) costó
  de 6 a 15 llamadas.
- **Docs viejos que engañaron**: el dominio que `CLAUDE.md` daba como no
  conectado (corregido en #392), la paleta coral de `design/COLOR_SYSTEM.md`
  como fuente de verdad (#359), los conteos de tests y la sección de deuda de
  `CLAUDE.md` (#374). Seguían mal y se corrigen acá: los ADRs citados como
  `0008` cuando los archivos son `ADR-0008-*.md`, el path de
  `startup_seed.py`, y las secciones "Decisiones clave vigentes" y "Dónde
  está cada cosa" de la bitácora (naranja, cloche, ADRs hasta 0007).
- **Respuestas de memoria al retomar un hilo** (2 de 10): dos sesiones
  dijeron que había cosas abiertas que ya estaban mergeadas.

**Qué cambió:**

- `docs/STATUS.md` pasa a ser corto y sólo de estado vigente. La bitácora
  vieja quedó congelada en `docs/historial/ARCHIVO-2026-07-a-2026-10-03.md`
  y cada cambio nuevo es un archivo propio en `docs/historial/`. Así ningún
  par de PRs edita la misma línea.
- `docs/reference/MAPA_DEL_CODIGO.md`: cada pantalla con lo que responde,
  sus piezas y su API, más una tabla de "dónde vive" lo que más se buscó.
- `docs/reference/SESION_CLOUD.md`: las recetas que funcionaron (worktree,
  venv con `uv`, build, capturas, trampas de git y CI).
- `frontend/playwright.config.ts` usa solo el Chromium preinstalado fuera
  de CI. Se verificó con `e2e/perfil-vista.spec.ts`: 5 de 5. `e2e/mocks.ts`
  suma `setTheme()` para las capturas en los dos temas.
- `.github/pull_request_template.md` (tres sesiones la buscaron).
- `CLAUDE.md`: el protocolo cubre el caso cloud del worktree, manda al mapa
  antes de proponer algo, y avisa de que un PR en conflicto queda sin CI.

**Lo que se descartó:** mover los reportes de la raíz
(`PRODUCTION_HARDENING.md`, `PERFORMANCE_REPORT.md`…) a `docs/audits/`. Hay
unos 30 comentarios de código que los citan por nombre, así que solo se
marcan en `CLAUDE.md` como fotos de un momento.

**Queda abierto:** las referencias "ver `docs/STATUS.md` <fecha>" en
comentarios de código apuntan ahora al archivo congelado. `STATUS.md` lo
aclara y no se tocó código por eso.

**Agregado en el mismo PR (2026-10-04): alerta de `braces`.** Security se
puso rojo por [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
que afecta a todas las versiones de `braces` y todavía no tiene parche.
Entraba sólo por el lint: `eslint-config-next → @next/eslint-plugin-next →
fast-glob → micromatch → braces`. El plugin usa una sola función de
`fast-glob` (`globSync(patrón, { onlyDirectories: true })`, en
`dist/utils/get-root-dirs.js`), y sólo cuando se configura
`settings.next.rootDir`, que acá no está. Por eso el override de
`package.json` reemplaza `fast-glob` por `tinyglobby` sólo para ese plugin.
`tinyglobby` tiene la misma función, ya estaba en el árbol (vite y
typescript-eslint) y no depende de `braces`. `npm audit` queda en 0, el lint
en 0 errores y Vitest en verde. **Cuando `@next/eslint-plugin-next` deje de
pinear `fast-glob@3.3.1`, o salga un `braces` parcheado, el override se
puede sacar.**
