# Etapa 3 de Cloudflare prendida en producción

**Pedido:** Julieta, 2026-10-15. Prender en los paneles el endurecimiento que
dejó listo el código de la etapa 3 (ADR-0018), con Claude in Chrome y a mano.

**Qué cambió (paneles, no código):**

- **Cloudflare, DNS:** `CNAME api → staffya-backend.onrender.com`, con proxy
  (nube naranja) después de que Render emitiera el certificado. Antes
  `api.oido.com.ar` caía en el comodín `*` hacia Vercel.
- **Render:** dominio `api.oido.com.ar` por `render.yaml` (#438), y las
  variables `TURNSTILE_SECRET_KEY` y `EDGE_SHARED_SECRET`.
- **Cloudflare, reglas:**
  - *Cloudflare Free Managed Ruleset*: ya venía activo (en el plan Free no
    se apaga).
  - Límite de intentos "Login y registro": por IP, 5 cada 10 s, bloqueo de
    10 s, sólo por ruta (el plan Free no deja host ni método).
  - Transform Rule "Marca de Cloudflare para la API": `X-Oido-Edge` (secreto)
    y `X-Oido-Client-IP` = `ip.src`, para `http.host eq "api.oido.com.ar"`.
  - Turnstile "Oído login y registro", modo Managed, hostnames `oido.com.ar`
    y `www.oido.com.ar`.
- **Vercel:** `NEXT_PUBLIC_API_URL=https://api.oido.com.ar/api/v1` y
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en Production, y redeploy.
- **Cierre del preset unsigned (#437):** `staffya-profile` pasado a *Signed*
  en Cloudinary y `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` borrada de Vercel.

**Cómo se verificó:**

- `https://api.oido.com.ar/health` → 200 con `server: cloudflare`.
- Login sin token de Turnstile → 400 ("No pudimos comprobar que no seas un
  robot"); con la casilla real en el navegador → "mail o contraseña
  incorrectos" (el token pasa).
- `staffya-backend.onrender.com/api/...` → 403; `/health` sigue en 200.
- El JS publicado llama a `api.oido.com.ar` y no a `onrender.com`; la CSP
  incluye `https://api.oido.com.ar`, `wss://api.oido.com.ar` y
  `challenges.cloudflare.com`.
- Subida sin firma con el preset viejo → Cloudinary responde "Upload preset
  must be whitelisted for unsigned uploads".
- Login con Google y navegación de admin: OK (Julieta).

**Por qué así:** el orden (frontend con la API nueva antes que el secreto en
Render; widget antes que la clave de Turnstile) evita dejar el sitio sin
login en cualquier paso intermedio.

**Trampas que aparecieron** (ya escritas en `reference/DEPLOY.md`):

- Render no muestra *Custom Domains* en servicios *Blueprint managed*: va en
  `render.yaml`.
- El límite de intentos del plan Free sólo acepta la ruta en la expresión.
- Un Redeploy en Vercel por cambio sólo de variables se cancela por el
  *Ignore Build Step*; hay que desmarcarlo en ese redeploy.
- La zona y Render están en la cuenta `julietaarrazate@gmail.com`, no en la
  de `hola@oido.com.ar`.

**Queda abierto:** HSTS de la zona (paso 7), etapa 4 (`*.workers.dev`, sumar
ese hostname a Turnstile y a `CORS_ORIGINS`) y etapa 5 (cambio de DNS, sólo
con el "sí" de Julieta).
