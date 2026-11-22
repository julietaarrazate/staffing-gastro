# La app instalada se recarga sola cuando hay versión nueva

**Pedido:** Julieta: la app instalada en el celular a veces mostraba el diseño viejo después de un deploy; tiene que recargarse sola.

**Qué cambió:** al abrir la app, al volver a primer plano y cada ~10 min, el navegador compara la versión de su código con la servida; si difiere, se recarga a lo sumo una vez por versión, sin cortar lo que la persona está haciendo: al abrir la app recarga en el acto; si estuvo 15 min o más fuera de primer plano, al volver; si no (por ejemplo, volvió de elegir una foto), en el próximo cambio de pantalla.
- `frontend/next.config.ts`: `BUILD_ID` (commit de Cloudflare/GitHub/Vercel, o `local-<hora>` en builds locales) como `NEXT_PUBLIC_BUILD_ID` y `generateBuildId`.
- `frontend/app/version.json/route.ts`: devuelve `{version}`, dinámica y con `Cache-Control: no-store` (corre en el Worker, no es un asset estático).
- `frontend/lib/version-app.ts` (lógica y anti-loop con `sessionStorage` en try/catch) y `frontend/components/ActualizadorVersion.tsx` (montado en `app/layout.tsx`); también llama `registration.update()` del service worker al volver a primer plano.
- `frontend/lib/push.ts`: el registro del SW usa `updateViaCache: "none"`.
- `frontend/public/sw.js`: al activar borra cachés viejas y hace `clients.claim()`. El SW sigue sin handler `fetch`: no cachea ni intercepta navegaciones ni `/_next/static`, así que no sirve HTML viejo; push y `notificationclick` intactos.
- Tests: `frontend/lib/version-app.test.ts`, `frontend/e2e/recarga-por-version.spec.ts`.

**Por qué así:** `/version.json` dinámico y sin caché en vez de un archivo estático, porque los assets de Cloudflare se sirven con revalidación y el Worker garantiza `no-store`. El HTML ya revalidaba siempre; la causa probable del diseño viejo es una pestaña/PWA abierta días sin navegar, que nunca pedía el código nuevo.

**Queda abierto:** en Cloudflare, confirmar que el build exponga el commit (`WORKERS_CI_COMMIT_SHA`); si no, cada build tiene igual un id propio (`local-<hora>`), distinto en cada deploy.
