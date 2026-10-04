# SESION_CLOUD.md — Recetas para una sesión de Claude en la nube

Todo lo de acá lo resolvió **más de una sesión desde cero**. La retro del
2026-10-03 leyó las diez sesiones anteriores, y cada una gastó entre 5 y 20
llamadas en redescubrir lo mismo. Si algo de esto deja de ser cierto,
corregilo acá en el mismo PR.

## 1. Worktree cuando la rama ya existe

En la nube, el entorno ya crea la rama de la sesión (`claude/project-thread-…`)
y la deja **checkouteada en el directorio principal**. Por eso el
`git worktree add … -b <rama> origin/main` de `CLAUDE.md` falla con *"a branch
named … already exists"*. Lo que anduvo en todas las sesiones:

```bash
cd /home/claude/staffing-gastro
git fetch origin main
git checkout -q --detach                 # libera la rama
git worktree add ../staffya-<tema> <rama-de-la-sesión>
cd ../staffya-<tema> && git reset -q --hard origin/main   # sólo si la rama está vieja y sin commits propios
```

El clon es **shallow**. Para arqueología de ramas (`git cherry`,
`rev-list --count`), primero `git fetch --unshallow`: sin eso los conteos
salen absurdos sin ningún error.

## 2. Backend: tests

`pip install` contra el Python del sistema falla (la rueda de `http-ece`, y
`PyJWT` instalado por Debian). Con `uv` anda en segundos:

```bash
uv venv -q -p 3.11 /tmp/claude-0/venv311          # CI usa 3.11
uv pip install -q -p /tmp/claude-0/venv311/bin/python -r backend/requirements.txt
cd backend && /tmp/claude-0/venv311/bin/python -m pytest -q tests/test_<área>.py
```

`requirements.txt` ya trae pytest, pytest-asyncio, httpx y aiosqlite. La
suite completa tarda **8 a 10 minutos**; durante el trabajo conviene correr
sólo los archivos del área, y la completa una vez antes del push. No uses
`-p no:logging`: rompe 6 tests.

## 3. Frontend: install, build y Playwright

- **Cada worktree necesita su `npm ci`** (unos 30 s). No symlinkees
  `node_modules` desde el directorio principal: ya rompió un build.
- **Playwright usa solo el Chromium preinstalado** desde el 2026-10-03
  (`frontend/playwright.config.ts`). Antes cada sesión escribía un config
  temporal con `executablePath`, porque la revisión instalada en
  `/opt/pw-browsers` no es la que pide la versión de Playwright. En CI no
  cambia nada.
- **El servidor de los E2E es `next start` sobre el build**, así que después
  de tocar código hay que correr `npm run build` antes de `npm run test:e2e`.
- `mapa-worker` falla siempre en la sesión porque no hay salida a los tiles
  de OSM. En CI pasa.
- `npm run lint` da **0 errores y unos mil warnings**. Es lo normal; CI
  falla sólo con errores.
- Si el build falla bajando Google Fonts por el proxy, probá
  `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npx next build --webpack`.

## 4. Capturas en claro y oscuro

El protocolo de sesión exige mirar la UI renderizada en los dos temas. La
forma que anduvo es un spec descartable al lado de los demás, que reusa los
mocks del spec más parecido a la pantalla:

```ts
// frontend/e2e/zz-captura.spec.ts  (borrarlo antes de commitear)
import { test } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

for (const theme of ["light", "dark"] as const) {
  test(`captura ${theme}`, async ({ page }) => {
    await injectSession(page);          // sesión falsa + tours ya vistos
    await skipSplash(page);             // la splash tapa todo ~1 s
    await setTheme(page, theme);
    await blockExternalHosts(page);
    await mockEmptyNotifications(page);
    // + los page.route de la pantalla, copiados del spec que ya la prueba
    await page.goto("/profile");
    await page.screenshot({
      path: `/mnt/project-files/capturas/<tema>/<pantalla>_390_${theme}.png`,
      fullPage: true,
    });
  });
}
```

```bash
cd frontend && npm run build && npx playwright test e2e/zz-captura.spec.ts
```

- **Dónde van:** `/mnt/project-files/capturas/<tema>/<pantalla>_<ancho>_<light|dark>.png`.
  El viewport por defecto es 390×844 (un celular); para tablet,
  `page.setViewportSize({ width: 768, height: 1024 })`.
- **Trampa de las páginas server-side** (`/turno/[id]`, `/terminos`,
  `/privacidad`): Next las arma en el servidor y `page.route` no las
  intercepta. Y si `NEXT_PUBLIC_API_URL` no está seteada, `lib/api.ts` usa
  **la API de producción**: la captura sale con datos reales o vacía, sin
  ningún error. Para esas pantallas hay que buildear con
  `NEXT_PUBLIC_API_URL=http://localhost:<puerto>/api/v1` y servir un mock en
  ese puerto. El `/api/v1` del final es obligatorio.
- **Matar el servidor:** `pkill -f "next start"` mata también la shell que lo
  corre (sale con 144). Usá `fuser -k 3100/tcp`.
- Para recortar imágenes hace falta `pip install pillow` en el venv.

## 5. Git, GitHub y CI

- **No se pueden borrar ramas remotas desde la sesión.** `git push --delete`
  corta con *"unexpected disconnect"*. Hay que pedírselo a Julieta.
- **La plantilla de PR** está en `.github/pull_request_template.md` (desde el
  2026-10-03; antes no había, y cada sesión la buscaba).
- **Si después del push no aparece ninguna corrida de CI en el PR, mirá
  primero si el PR tiene conflicto.** Con el PR abierto, la corrida de `push`
  se saltea a propósito (`.github/actions/corrida-duplicada`), y un PR en
  conflicto no dispara `pull_request`. Resultado: ninguna señal, sin error. Ya
  pasó con un PR que estuvo un día así (#394).
- **Security puede ponerse rojo a mitad de un PR sin que tu diff tenga la
  culpa:** salen advisories nuevos (pasó con pyjwt, undici y Next). Se sube
  la dependencia en el mismo PR. Antes fijate si hay un PR de Dependabot que
  ya lo hace.
- El MCP de Render suele no conectar desde la sesión, así que no se puede
  verificar un deploy de backend desde acá. Decilo, no lo des por hecho.

## 6. Al retomar un hilo después de horas

Antes de contestar "qué falta" o "está cerrado", volvé a leer
`docs/STATUS.md` y el estado real de los PRs. Dos sesiones contestaron de
memoria después de dos días, con PRs que ya estaban mergeados, y las tuvo que
corregir otra sesión.
