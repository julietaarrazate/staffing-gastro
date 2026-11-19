# e2e-local — arnés de prueba de punta a punta de Oído

Levanta la app real (frontend de producción + backend FastAPI con `ENVIRONMENT=production`) contra una **base Postgres local** y con los **servicios de terceros simulados**. Sirve para recorrer los flujos con navegador (Playwright), mirar capturas en claro y oscuro, y registrar hallazgos, sin tocar producción: ni Neon, ni Render, ni Cloudinary, ni Resend reales.

El código vive acá, versionado. **Todo lo que se genera** (logs, capturas, archivos subidos, mails, admins, secretos, certificado, archivos de prueba, marcas) va a un directorio externo, nunca al repo.

## Arranque

```bash
tools/e2e-local/setup.sh       # una vez por contenedor (idempotente)
tools/e2e-local/start_all.sh   # levanta simulados, backend y frontend
```

`setup.sh` crea el venv con `uv`, levanta Postgres si está caído, crea rol y base si faltan, corre `alembic upgrade head` y construye el frontend sólo si no hay build (`--build` fuerza el build). `start_all.sh` no toca lo que ya responde, siembra datos demo la primera vez (~1 min) y crea los admins de prueba. `status.sh` muestra qué está arriba; `stop_all.sh [frontend|backend|simulados]` baja por puerto (Postgres queda arriba).

Prueba de humo (borra lo que crea): `E1_AGENT=smoke node tools/e2e-local/smoke.mjs`.

### Variables

| Variable | Defecto | Qué es |
|---|---|---|
| `E1_DIR` | `/tmp/oido-e2e` | Estado y datos generados: `state/` (admin.json, `.env.e1`, TOTP, certificado, archivos de prueba, marca de seed), `logs/`, `evidence/`, `cloud/`, `mailbox.jsonl`, `agents/`, `results/`. |
| `E1_REPO` | `tools/e2e-local/../..` | Raíz del repo. |
| `E1_PY` | `$E1_DIR/venv/bin/python` | Intérprete de Python del backend. |
| `E1_DB` | `oido_e1` | Base local. Arma `DATABASE_URL` si no viene seteado (el backend se niega a arrancar si no es local). |

Con `E1_DIR` y `E1_DB` distintos se puede tener una pila de prueba separada. Los puertos son fijos: frontend 3100, backend 8000, simulados 8901 (http) y 8902 (https), así que sólo cabe una pila a la vez.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Frontend (`next start`) | `http://localhost:3100` (usar **localhost**, no 127.0.0.1: CORS y cookie) |
| Backend | `http://localhost:8000/api/v1` |
| Simulados | `http://127.0.0.1:8901` (y `https://127.0.0.1:8902`, mismo proceso) |
| Logs | `$E1_DIR/logs/{backend,frontend,fakes}.log`, `sessions/<sesión>.jsonl`, `gemini.jsonl`, `cloudinary.jsonl`, `push.jsonl`, `db.jsonl` |
| Mails "enviados" | `$E1_DIR/mailbox.jsonl` (o `mailbox(email)` desde el kit) |
| Capturas | `$E1_DIR/evidence/<E1_AGENT>/` |
| Scripts propios de recorrido | `$E1_DIR/agents/<nombre>/` |

## Kit (`kit.mjs`)

```js
import * as kit from "/ruta/al/repo/tools/e2e-local/kit.mjs";
const browser = await kit.launch();
const comercio = await kit.registerViaApi({ role: "employer", email: kit.uniq("ag07-bar") });
const s = await kit.newSession(browser, { name: "ag07-comercio", viewport: "mobile", theme: "light" });
await kit.loginAs(s.page, comercio);
await s.page.goto("/shifts/new");               // baseURL = http://localhost:3100
await s.shot("publicar-paso1");                 // evidence/<E1_AGENT>/publicar-paso1_390_light.png
console.log(s.log.problems());
await s.close(); await browser.close();
```

Correr con `E1_AGENT=<nombre> node recorrido.mjs`. Con `import "playwright"` directo no resuelve en ESM fuera del repo: usar `kit.launch()` o `kit.playwright`.

| Función | Qué hace |
|---|---|
| `launch()` | Chromium preinstalado; genera los archivos de `assets` la primera vez. |
| `newSession(browser, { name, viewport, theme, geo?, skipTours?, skipSplash?, googleUser?, agent? })` | Contexto aislado (localStorage y cookies propios). `viewport`: `"mobile"` 390x844 @2x táctil, UA Android; `"desktop"` 1280x800. `theme` fijado antes del primer render. Idioma `es-AR`, hora de Buenos Aires. Sin `geo` el navegador rechaza la ubicación; con `geo: { lat, lng }` la concede. `skipTours: false` muestra los tours; `skipSplash: false` la splash. Devuelve `{ context, page, log, shot, setGeo, setGoogleUser, close }`. |
| `s.shot(nombre, { fullPage?, page? })` | Captura en `evidence/<agente>/<nombre>_<390\|1280>_<light\|dark>.png`. Hay que mirarla: tsc y tests no ven contraste ni superficies. |
| `s.log` | `entries`, `of(tipo)`, `problems()`, `summary()`. Tipos: `console-error`, `console-warning`, `pageerror`, `csp`, `http-error` (>=400 del backend), `http-error-front`, `requestfailed`, `request-aborted` (prefetch de Next, no es problema), `external-unrouted`, `fake-error`, `shot`. |
| `registerViaApi({ role, email, password?, fullName?, verify?, profile? })` | Cuenta lista por el camino real (registro con términos, link del mail, login, perfil mínimo). `verify: false` la deja sin confirmar; `profile: false`, sin perfil. Contraseña por defecto `E1-prueba-1234`. El `token` vence a los 15 min: `apiLogin({ email, password })` da otro. |
| `loginAs(page, { email, password })` | Login por la UI real. |
| `adminSession(browser, { n, ...opts })` | Sesión logueada como `admin<n>@e1.test` pasando los dos pasos por la UI. |
| `adminApiToken(n)` · `admins()` · `admin(n)` · `totpNow(n)` · `totpFresh(n)` | Admin por API y datos de `admin.json`. El backend no acepta dos veces el mismo código de 30 s: para logins seguidos usar `await totpFresh(n)`. |
| `api(method, path, { token, body })` | Backend real sin navegador; devuelve `{ status, ok, data }` sin tirar en 4xx/5xx. |
| `mailbox(email)` · `waitForMail(email, { subject?, timeoutMs })` · `linkFrom(mail, /patrón/)` | Mails "enviados" a esa casilla. |
| `db(sql)` | SQL sobre `E1_DB`; filas como objetos, todo texto (`""` = NULL). Queda anotado en `logs/db.jsonl`. |
| `counter(page)` | Cuenta toques, teclas y caracteres, con marcas de tiempo (`mark`, `between`, `report`, `reset`). Para medir "cubrir un turno". |
| `uniq(prefijo)` | Mail único `<prefijo>-<aleatorio>@e1.test`. |
| `waitForUpload(page)` | Espera la respuesta de una subida; llamarlo antes de disparar la subida. |
| `assets` | Archivos para `setInputFiles`: `foto`, `logo`, `portada`, `dniFrente`, `dniDorso`, `selfie`, `constancia`, `cv`, `texto` (no es imagen), `grande` (JPG de 11 MB, supera el tope). |
| `googleCredential({ email, name })` | `id_token` falso para `POST /auth/google` por API. |
| `fakePushSubscription(label)` · `pushOutbox(endpoint)` | Suscripción push con forma válida y conteo de push salidos hacia ella. |

## Qué está simulado y qué significa

Lo simulado prueba **la plomería** (la app llama bien y reacciona bien a la respuesta), no al tercero.

| Tercero | Cómo | Límite |
|---|---|---|
| Mails (Resend) | El backend manda igual; el simulado los guarda. | No prueba entrega, spam ni cómo se ve en un cliente. `…e1bounce…@e1.test` hace fallar el envío (422). |
| Google (login) | Botón común "Continuar con Google (simulado)"; entra como `googleUser` de la sesión (o `google.default@e1.test`). El backend verifica contra un tokeninfo simulado. | No hay popup ni selector de cuentas; el real es un iframe de Google. |
| Cloudinary | Subida firmada validada como la real (firma, formatos, tope de 10 MB, `private`); archivos en `$E1_DIR/cloud/`. Las URLs `res.cloudinary.com/oido-e1/…` se sirven; los privados dan 401 salvo con el link que vence. | Se ignoran las transformaciones (`f_auto`, `w_…`). Una imagen inexistente se ve como placeholder: no es un bug. Un archivo `…e1fail…` hace fallar la subida (500). |
| IA (Gemini) | **Reglas fijas, no hay modelo**: detecta puesto, día, horario, pago, comida, propinas y vestimenta; lo que no entiende vuelve como faltante. Cubre las cuatro funciones. Lo "entendido" queda en `logs/gemini.jsonl`. | Probar la plomería, no la calidad. En el texto: `E1_IA_CAIDA` = proveedor caído (503), `E1_IA_INVALIDA` = respuesta rota, `E1_IA_LENTA` = tarda 8 s. |
| Direcciones (Nominatim) | 3 a 5 resultados fijos de CABA con la forma real. | `zzzz` / `xxxx` = sin resultados; `e1error` = servicio caído. No evalúa precisión. |
| Mapa base (CARTO) | Fondo neutro con grilla. Pines, clusters, ubicación y gestos son del producto. | Sin calles ni nombres. |
| Fotos demo (loremflickr, pravatar) | Placeholders de color. | — |
| Push | El backend manda de verdad (VAPID) a un simulado. `pushOutbox()` dice que **salió**, no su contenido. | No prueba la notificación en el dispositivo. |
| Captación de comercios (Overpass/OSM) | 6 comercios ficticios por barrio. | — |

Un pedido a un host externo sin simulado se corta y queda en el log como `external-unrouted`: si aparece, la app llama a algo que nadie declaró. En el backend, `e1.red: … reenviada al simulado` es una llamada a un tercero desviada; `salida BLOQUEADA` es una llamada sin simulado.

## Qué NO se puede probar así

Push real en el dispositivo · Turnstile (apagado) · Mercado Pago (apagado: sin cobro ni límites de plan, salvo `SUBSCRIPTIONS_ENFORCED`) · GPS real (sólo la posición que se le da a la sesión) · instalación como PWA · entrega real de mails · rendimiento de red y caché HTTP (el kit desactiva la caché) · TLS/HSTS (todo es http en localhost) · calidad de la IA y precisión del geocoder o del mapa.

## Reglas de uso

1. **Nada de producción.** `run_backend.py` se niega a arrancar si `DATABASE_URL` no es local y corta toda salida a internet.
2. **Cuentas con prefijo propio**: `uniq("ag07-comercio")`. No usar cuentas de otro agente. Las demo (`demo.*@staffya.com`, contraseña `staffyaDemo123`, mail sin verificar) son compartidas: para mirar, no para cambiarles datos.
3. **`db()` sólo sobre filas propias** (por ejemplo para adelantar el reloj de un turno tuyo) y decirlo en el hallazgo. Nunca `delete`/`update` masivos.
4. **No reiniciar ni matar servidores si hay otros agentes trabajando.** Si algo no responde: `status.sh` y avisar a quien coordina.
5. Un admin por agente: `adminSession(browser, { n })` con `n` de 1 a 8. `admin9@e1.test` queda sin verificación en dos pasos, para probar su alta.
6. No tocar el repo desde un recorrido; los scripts propios van en `$E1_DIR/agents/<nombre>/`.

## Configuración y cómo relanzar el backend

Base: `ENVIRONMENT=production`, `RATE_LIMIT_ENABLED=false` (todos salen de 127.0.0.1), `SUBSCRIPTIONS_ENFORCED=false`, Mercado Pago, Turnstile y `EDGE_SHARED_SECRET` vacíos, `GUEST_ACCESS_PIN=246810` ("Explorar sin cuenta").

**Único cambio de comportamiento del backend:** el arnés acepta casillas `@e1.test`. El producto las rechaza porque `.test` es un dominio reservado; sin esto no se podrían crear cuentas de prueba. Todo lo demás es el código real.

`run_backend.py` respeta cualquier variable ya seteada (`--print-env` muestra la config efectiva). Para relanzar sólo el backend con otra configuración (corta las conexiones abiertas; las sesiones siguen valiendo):

```bash
RATE_LIMIT_ENABLED=true SUBSCRIPTIONS_ENFORCED=true tools/e2e-local/restart_backend.sh
tools/e2e-local/restart_backend.sh        # vuelve a la config de base
```

El backend usa el pool de producción (1 conexión + 10 de desborde). Si aparece `QueuePool limit` en `backend.log`, es efecto de la carga del arnés: anotarlo con la hora.

## Cuentas

- **Admin**: `admin1@e1.test` … `admin8@e1.test` con verificación en dos pasos; `admin9@e1.test` sin activar. Contraseñas, secretos TOTP y códigos de recuperación en `$E1_DIR/state/admin.json` (se generan en `start_all.sh`).
- **Invitado**: en `/login`, "Explorar sin cuenta", PIN `246810`.
- **Demo**: ver regla 2. Hay 12 comercios, 14 trabajadores y 14 turnos publicados.

## El scheduler (corre de verdad)

Está en `backend/app/modules/shift/application/scheduler.py`. No tiene intervalo fijo: después de cada pasada duerme hasta la próxima fecha límite que conoce (mínimo 30 s, máximo 6 h; 5 min si una pasada falló) y se despierta antes cuando alguien **publica** o **confirma** un turno.

| Cuándo | Qué |
|---|---|
| 8 min después de publicar, si sigue abierto | Escalada de urgencia: marca `urgent` y avisa a más candidatos. |
| 90 min antes del inicio (confirmado, sin salir) | Recordatorio de salida ("va en camino"). |
| 20 min después del inicio, sin llegada | Recordatorio "¿ya llegaste?" (una vez). |
| 2 h después del inicio, sin llegada | No-show automático. |
| Inicio + 30 min (urgente) o + 2 h (no urgente), nunca confirmado | Pasa a no cubierto. |
| 4 h después de prender "Disponible ahora" | Se apaga sola. |
| 1 vez por día | Limpieza de sesiones vencidas y avisos leídos viejos. |

Otros plazos: llegada anticipada hasta 30 min antes; "va en camino" desde 2 h antes; tolerancia de puntualidad 15 min; pago a tiempo 48 h. El aviso de vencimiento de plan no corre (cobro apagado).

**Adelantar el reloj de un turno propio**: cambiar sus fechas con `db()` y después **publicar o confirmar cualquier turno propio** para despertar al scheduler (si no, puede tardar hasta su próxima fecha límite):

```js
kit.db(`update shifts set start_at = now() - interval '2 hours 5 minutes', end_at = now() + interval '3 hours' where id = '${miTurno.id}'`);
```

## Cosas que confunden

- Las capturas apagan las animaciones. Para ver una, `s.page.screenshot({ animations: "allow", path })`.
- Las páginas armadas en el servidor (`/turno/[id]`, `/terminos`, `/privacidad`) le pegan al backend desde Node: funcionan, pero sus pedidos no aparecen en `s.log`.
- Al subir una foto de perfil el producto abre un recuadro para encuadrar ("Usar esta foto"); DNI, selfie, CV y constancia suben directo.
- La prueba de humo borra lo que crea. Si hay cuentas `smoke-*`, hay una corriendo (o se cortó a la mitad).
- Los pedidos del scheduler y los push salen del backend, no del navegador: están en `backend.log`, no en `s.log`.
- Usar `localhost`, no `127.0.0.1`, en el navegador.
- Los mails con `…e1bounce…`, archivos `…e1fail…` y textos `E1_IA_*` son disparadores deliberados de errores simulados.
- Si el frontend se reconstruye con otra `NEXT_PUBLIC_API_URL`, el arnés deja de apuntar al backend local: usar `setup.sh --build`, que fija los valores correctos.
