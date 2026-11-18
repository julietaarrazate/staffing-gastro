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

- **La salida de una falla trae miles de líneas de DEBUG** (las tablas que
  crea cada test). Para leerla sin llenar el contexto:
  `… | grep -E "^E   .{0,200}$|[0-9]+ (passed|failed)|^FAILED" | head -20`.
- **La completa va sin `-x`.** Con `-x` corta en la primera falla y esconde
  las demás; con cuatro tareas a la vez tarda 15 a 25 minutos.
- **La completa encuentra lo que el área no.** El 2026-11-18 (G4) los tests
  del área y la revisión independiente estaban en verde, y la suite completa
  cortó en `test_privacidad_datos_trabajador`: una fila nueva de postulación
  le abría el CV al comercio. No pushees con sólo los tests del área si
  tocaste un modelo que leen otros módulos. Pasó otra vez ese día con
  U072: un arreglo posterior a la revisión rompió un test de concurrencia de
  otro archivo y lo encontró CI (una vuelta de 20 minutos). La completa se
  corre también después del último cambio, no sólo antes de la revisión.

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
- **`playwright.config.ts` fija el puerto 3100 con `reuseExistingServer`.** Si
  en 3100 ya corre otra cosa (el entorno de `tools/e2e-local`, o el servidor
  de otro worktree), `npm run test:e2e` se engancha a ese servidor y prueba
  otro código sin avisar (visto el 2026-11-13 con cinco worktrees a la vez).
  Con más de un worktree, cada uno corre sus specs con un config temporal
  fuera de git, en un puerto propio y con `reuseExistingServer: false`.
  Ese config tiene que estar **adentro de `frontend/`** (sin commitear, por
  ejemplo `frontend/pw-local.config.ts`): desde el scratchpad no resuelve
  `@playwright/test` (lo redescubrieron cuatro agentes el 2026-11-14).
- **Un subagente que arregla un área corre la suite e2e COMPLETA antes del
  push, no sólo los specs del área.** El 2026-11-16, tres de cinco PRs (G15,
  G20, G23) pasaron sus specs y cayeron en CI por specs de otras pantallas que
  esperaban la URL exacta `/shifts/new` o no simulaban un pedido nuevo. Cada
  vuelta de CI son ~5 minutos.
- **Con varias ramas en paralelo, probá el merge entre ellas antes de pedir
  el "sí".** Dos PRs que agregan una importación en el mismo lugar chocan
  aunque no tengan nada que ver; se ve con un `git merge --no-commit` local y
  se evita un ciclo de CI por par.
- **Que dos ramas no choquen en el texto no alcanza: corré los tests sobre
  todas juntas antes de mergear la segunda.** El 2026-11-13 #549 y #552
  pasaron su CI por separado, se mergearon con un minuto de diferencia y
  `main` quedó en rojo: un test de una marcaba la salida antes del inicio, que
  la otra pasó a rechazar (#555). Tras cada merge, a la rama que sigue se le
  trae `main` y se espera su CI, aunque el merge sea limpio.
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
  Hay entornos sin `/mnt/project-files` (visto el 2026-10-30, repo en
  `/home/user`): ahí van al scratchpad de la sesión, y el PR dice la ruta.
  El viewport por defecto es 390×844 (un celular); para tablet,
  `page.setViewportSize({ width: 768, height: 1024 })`.
- **Trampa de las páginas server-side** (`/turno/[id]`, `/terminos`,
  `/privacidad`): Next las arma en el servidor y `page.route` no las
  intercepta. Y si `NEXT_PUBLIC_API_URL` no está seteada, `lib/api.ts` usa
  **la API de producción**: la captura sale con datos reales o vacía, sin
  ningún error. Para esas pantallas hay que buildear con
  `NEXT_PUBLIC_API_URL=http://localhost:<puerto>/api/v1` y servir un mock en
  ese puerto. El `/api/v1` del final es obligatorio.
- **Una pantalla que sale de `notFound()` se dibuja en el navegador**, no en
  el servidor: llega un HTML vacío (`<html id="__next_error__">`) y el layout
  se arma del lado del cliente, así que el `<script>` anti-flash del tema no
  corre. El 2026-11-12 la captura oscura de «Este turno ya no está
  disponible» salía idéntica a la clara, y los tests estaban en verde. En el
  spec de captura conviene afirmar el tema antes de sacar la foto:
  `await expect(page.locator("html")).toHaveAttribute("data-theme", theme)`.
- **Matar el servidor:** `pkill -f "next start"` mata también la shell que lo
  corre (sale con 144). Usá `fuser -k 3100/tcp`.
- Para recortar imágenes hace falta `pip install pillow` en el venv.

## 5. Git, GitHub y CI

- **Una sola rama por sesión, un PR por ítem** (visto el 2026-11-18): el
  entorno deja pushear a una rama, así que los PRs van de a uno. Lo que
  anduvo: cada ítem en su worktree con una rama **local**
  (`git worktree add ../staffya-<tema> -b claude/<tema> origin/main`), todo
  se escribe, revisa y prueba en paralelo, y al mergear un PR se pushea el
  siguiente con `git push --force-with-lease origin HEAD:<rama-de-la-sesión>`
  después de `git rebase origin/main`. Para la prueba en la app, un worktree
  más con todas las ramas mergeadas (sin pushear) y el arnés sobre ese árbol.
  El ítem que espera un «sí» va último: mientras su PR está abierto la rama
  queda tomada.
- **El aviso de «CI falló» puede ser de un commit viejo.** Cada push corta la
  corrida anterior y esa llega como falla. Mirá el `head_sha` del aviso contra
  `git rev-parse HEAD` antes de investigar.
- **`gh` puede no tener sesión** (*"Failed to log in to github.com using
  token (GH_TOKEN)"*, visto el 2026-10-30). `git push` igual anda; el PR
  en draft y los checks se manejan con las herramientas MCP de GitHub
  (`create_pull_request`, `pull_request_read` con `get_check_runs`).
- **No se pueden borrar ramas remotas desde la sesión.** `git push --delete`
  corta con *"unexpected disconnect"*. Hay que pedírselo a Julieta.
- **gitleaks escanea el historial de TODAS las ramas** (`--log-opts=--all`),
  y toma como `generic-api-key` un literal con forma de UUID o token en un
  test (visto el 2026-11-17 con `Idempotency-Key` en `test_support.py`). Un
  commit que lo corrige no alcanza: el commit viejo sigue en la rama y
  además **pone en rojo el Security de todos los demás PRs abiertos**, porque
  cada corrida ve todas las ramas. Usá strings legibles
  (`"abrir-ticket-reintento"`, como el resto del repo) y, si ya se pusheó,
  rehacé la rama propia sin ese commit y pusheá con `--force-with-lease`.
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

## 7. Probar la app de punta a punta contra backend y base locales

Los E2E del repo (`frontend/e2e/`) corren con toda la API simulada. Para
recorrer un camino completo con el frontend y el backend reales conectados
está `tools/e2e-local/` (desde el 2026-11-11, etapa 1 de la salida a beta):

```bash
tools/e2e-local/setup.sh       # venv, Postgres local, migraciones y build (idempotente)
tools/e2e-local/start_all.sh   # simulados, backend y next start; deja todo arriba
E1_AGENT=smoke node tools/e2e-local/smoke.mjs   # prueba de humo (borra lo que crea)
```

- El estado (logs, capturas, casilla de mails, cuentas admin de prueba) va a
  `E1_DIR`, fuera del repo. Nada toca producción.
- Lo que hay que saber antes de usarlo está en su `README.md`: qué exporta
  `kit.mjs`, qué está simulado y qué no se puede probar así.
- Desde el contenedor **no hay salida** al mapa base, al buscador de
  direcciones, a Cloudinary, a Turnstile ni a `www.oido.com.ar`. Por eso
  están simulados, y por eso una pantalla que dependa de ellos sale vacía
  fuera del arnés.
- Las páginas armadas en el servidor (`/turno/[id]`) le pegan al backend
  local desde Node: funcionan, pero sus pedidos no pasan por el navegador.
- **Si el árbol cambió después de levantar la pila** (un merge, un commit
  nuevo), el backend y el frontend siguen corriendo el código viejo sin
  avisar: `restart_backend.sh`, y `setup.sh --build` + `stop_all.sh frontend`
  + `start_all.sh` para el frontend. El 2026-11-14 una prueba leyó un texto
  ya corregido porque el backend había arrancado diez minutos antes del
  merge.
- Para probar varios PRs juntos antes de mergearlos: un worktree aparte con
  las ramas mergeadas en local (sin pushear) y el arnés corriendo sobre ese
  árbol.
- **Si `setup.sh` dice «✗ alembic falló», no compiló el frontend** y
  `start_all.sh` igual levanta el build anterior sin avisar: la prueba mira
  código viejo. Pasa al cambiar el árbol de prueba a uno que no tiene una
  migración que la base local ya aplicó (visto el 2026-11-18: la base en 0050
  y el árbol sin U110). Mirá la línea de alembic antes de probar; con varias
  ramas con migraciones, mergeá en el árbol de prueba todas las que la base
  ya vio.
- Para la corrida con el límite de intentos y el tope del plan:
  `RATE_LIMIT_ENABLED=true SUBSCRIPTIONS_ENFORCED=true tools/e2e-local/restart_backend.sh`.
  Con el límite prendido todas las cuentas salen de `127.0.0.1`: conviene que
  corra un solo agente.

## 8. Trabajo largo con muchos subagentes: el límite de uso y los reinicios

Pasó tres veces el 2026-11-11, en una prueba de 16 recorridos en paralelo:

- **El límite de uso de la cuenta corta a todos los subagentes a la vez**
  (*"You've hit your 5-hour limit"*) y el workflow devuelve vacío. Lo que
  salvó el trabajo: cada agente lleva `NOTAS.md` y reescribe un
  `<nombre>.parcial.json` después de cada paso, y el relanzado empieza
  leyendo eso. Sin esa regla se pierde todo lo que no terminó.
- **El contenedor se reinicia** y mata Postgres y los servidores; los
  archivos del scratchpad y del worktree siguen. Antes de relanzar:
  `pg_ctlcluster 16 main start` y `start_all.sh`.
- **Lo que más gasta es verificar.** Sacar los repetidos entre recorridos
  antes de verificar bajó 226 anotaciones a 144 grupos, y un problema visto
  por dos recorridos distintos ya está corroborado. El modelo más potente
  alcanzó para los candidatos a bloqueante y el ciclo central; los barridos
  anchos y la verificación de graves y menores anduvieron bien en Sonnet.
- **Un agente puede dejar en su archivo sólo un puntero** ("ver la salida
  estructurada"). El resultado completo queda en el `journal.jsonl` del
  workflow: se recupera de ahí.
- `import "playwright"` no resuelve en ESM desde el scratchpad (sólo
  `require`): usar `kit.launch()`.
- Una regla de `.claude/settings.json` bloquea leer dentro de `.next`, y eso
  alcanza a un `ls` de Bash sobre esa ruta. Para saber si hay build, un
  `test -f` dentro de un script.
