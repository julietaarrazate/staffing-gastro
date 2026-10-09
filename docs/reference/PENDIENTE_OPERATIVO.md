# Pendiente operativo de Julieta (no es trabajo de código)

Movido desde `CLAUDE.md` (2026-10-09). Solo leer si la tarea toca env vars, dominio, deploy o trámites.

## Pendiente de la operadora (Julieta — no es trabajo de código)

### Estado de env vars (verificado con Julieta el 2026-09-08)

> **No queda ninguna env var bloqueante.** Todo lo de más abajo está
> resuelto salvo donde diga lo contrario; los ítems tachados se dejan para que
> nadie los vuelva a pedir.

#### ✅ ~~Conectar `oido.com.ar`~~ — resuelto el 2026-09-08

`oido.com.ar` (redirige con 308 a `www.oido.com.ar`) y `www.oido.com.ar`
están en el proyecto de Vercel, **verificados** (consultado contra la API de
Vercel el 2026-09-28). Google Cloud, `CORS_ORIGINS`, `EMAIL_FROM` y
`FRONTEND_URL=https://oido.com.ar` quedaron cargados ese mismo día (detalle
en `docs/historial/ARCHIVO-2026-07-a-2026-10-03.md`, "Qué sigue", punto 1). Este bloque estuvo en rojo tres
semanas después de resuelto y una sesión le dijo a Julieta que el dominio
"no estaba conectado": si lo ves pendiente en otro lado, es una copia vieja.

Los **íconos** están todos en ámbar (2026-09-23): los PNG y el `favicon.ico`
se regeneran desde los SVG con `node scripts/build-icons.mjs` (en
`frontend/`), y la vista previa al compartir un link ya no es un PNG
commiteado sino `frontend/lib/og-brand.tsx`, generada desde el código (servida como JPEG en `/og/oido.jpg`). **Las
URLs absolutas salen de `frontend/lib/site.ts`** (`www.oido.com.ar`, porque el dominio sin `www` redirige ahí): antes
estaban escritas a mano como `staffya.com.ar`, un dominio que no existe, y
toda vista previa y el sitemap apuntaban ahí.

**Ya configuradas — NO volver a pedirlas:**
- **Vercel (frontend):** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`,
  `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_SENTRY_DSN`.
- **Render (backend):** `CORS_ORIGINS`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`,
  `JWT_SECRET_KEY`, `RESEND_API_KEY`, `SEED_DEMO_DATA`, `SENTRY_DSN`,
  `VAPID_CONTACT_EMAIL`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`.
- Efecto: **Cloudinary** (foto de perfil + subida de DNI/selfie), **Google
  login**, **push (VAPID)**, **Sentry**, **emails (Resend)** quedan operativos.

**Faltan / a confirmar:**
1. ✅ ~~**`ADMIN_EMAILS`** (Render)~~ — **resuelto** (confirmado por Julieta,
   2026-09-07: su mail ya está cargado y entra a `/admin`). Este ítem estuvo
   marcado en rojo como "el más importante y el que falta" durante semanas
   después de estar resuelto; si lo leés en rojo en algún lado, es una copia
   vieja. La verificación de identidad F1 quedó operativa de punta a punta.
2. 🟠 **`SEED_DEMO_DATA` = `true` a propósito, por ahora** (Render, decisión
   de Julieta 2026-09-22): sin usuarios reales, la app se ve poblada con los
   comercios/trabajadores demo, y cada arranque repone sus turnos vigentes.
   Queda fijado también en `render.yaml`, para que el archivo y el panel no
   se contradigan. (El 2026-09-23 se culpó a `render.yaml` de pisar el panel;
   la causa real de que no se sembrara nada era un bug de event loop en
   `backend/scripts/startup_seed.py` — ver `docs/BUGS.md`.)
   **Antes de abrir la beta con gente real** va a `false` y se purgan las
   cuentas demo (runbook en `docs/reference/DEPLOY.md`): tienen contraseña
   pública y sus turnos entran en la referencia de pago.
3. 🟢 **`MERCADOPAGO_ACCESS_TOKEN`** (Render): sólo para pagos reales; el
   enforcement está apagado, así que **no urge** para la beta.
4. 🟠 **Confirmar** `ENVIRONMENT=production` (Render) y `NEXT_PUBLIC_API_URL`
   (Vercel, apuntando al backend de Render): si la app anda, casi seguro ya
   están; sólo verificar que existan. **Subió de prioridad (2026-08-08,
   TECH_DEBT.md S1):** ahora también controla si la cookie del refresh token
   sale con `Secure`+`SameSite=None` (`settings.is_production`) — sin esta
   var en `"production"`, el navegador descarta la cookie en la request
   cross-site real Vercel→Render, el login sigue andando pero el refresh/
   logout fallan en silencio y todos tendrían que volver a loguearse cada 15
   minutos.
5. ✅ **`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`** (Render, cargadas
   2026-08-10, C.2(b) auditoría de producto): habilitan la subida de CV
   **firmada** (`POST /uploads/sign-cv`) — evita que cualquiera suba
   archivos a la cuenta de Cloudinary sin pasar por el backend. **Ojo:**
   esto por sí solo NO resuelve "el PDF sube pero no abre" (ver el ítem de
   abajo, corregido tras probarlo en vivo) — hace falta además el toggle
   del dashboard.
6. 🟠 **`GEMINI_API_KEY`** (Render, nueva 2026-08-10, P2 auditoría de
   producto): habilita "Describí el turno" en `/shifts/new` — el comercio
   escribe algo como "necesito un mozo el sábado a la noche, se paga
   45000" y se precargan puesto/horario/pago (nunca publica nada solo, el
   comercio revisa y confirma cada paso). Se saca de
   [aistudio.google.com](https://aistudio.google.com) → "Get API key"
   (cuenta de Google, plan free — alcanza de sobra: 250 requests/día con
   `gemini-3.5-flash`, la versión GA estable fijada en `core/gemini.py`
   — `gemini-2.5-flash` dejó de estar disponible para cuentas nuevas, ver
   `docs/historial/ARCHIVO-…` 2026-08-11; **no** se usa el alias `-latest` a
   propósito, Google documenta que puede hot-swapear a un preview/
   experimental sin deploy propio). Sin esta var, `POST /shifts/parse-text`
   responde 503 (flag por ausencia) y el botón "Completar" muestra un
   error claro en vez de fallar en silencio.

> El **PIN de acceso invitado** ("Explorar sin cuenta") **no** es env var: se
> configura en el código (`IdentityService.GUEST_ACCESS_PIN`, hoy `3526`).

**Otros pendientes operativos (no env vars):**
- ✅ **Dominio propio `oido.com.ar`** (comprado en NIC.ar, 2026-09-02,
  conectado el 2026-09-08; ver arriba).
  El **dominio de envío propio en Resend ya está**: verificado contra su API
  el 2026-09-09 — `oido.com.ar` en estado `verified` (región `sa-east-1`) y
  los mails salen de `Oído <hola@oido.com.ar>`, no del sandbox `resend.dev`.
  Si leés en algún lado que falta confirmarlo, es una copia vieja.
  Opcional y sin bloquear nada: dominio propio para el backend
  (`api.oido.com.ar` en vez de `staffya-backend.onrender.com`).
- ✅ ~~**Expediente de registro de obra ante la DNDA**~~ — **presentado por
  Julieta el 2026-09-23** (arancel, tasa y constancia de CUIL ya cargados en
  el trámite). Versión depositada: commit `e1c44b6`, marcada con la etiqueta
  `dnda-oido-2026-v1` (release de GitHub creado por ella). El ZIP entregado
  tiene el código fuente, el frontend compilado y 9 PDFs (los 8 documentos +
  capturas de pantalla). Lo que queda es esperar la respuesta de la DNDA. La
  rama `registro-obra-software-dnda` (PR #310) **sigue en draft y no se
  mergea**: es el registro del expediente y lleva el DNI de Julieta. Si la
  DNDA pide algo, partir de `REGISTRO_OBRA_SOFTWARE/DNDA_VERSION_REGISTRADA.md`
  en esa rama; la obra se describe siempre como de **autoría exclusiva de
  Julieta**, y el expediente no nombra otras apps.
- **Ensayo de restore de Neon**: confirmar que el backup/restore funciona de
  verdad antes de depender de él con usuarios reales.
- Confirmar en el dashboard de Render que el deploy quedó verde contra Neon
  (incluida la migración `0025` de identidad).
- **WhatsApp Business API** (feature de enganche): requiere cuenta/API de
  Julieta — distinto del botón "Compartir por WhatsApp" (`wa.me`, #77).
- Subir fotos reales al seed (R2.5): requiere la cuenta Cloudinary del proyecto.
- El preset de Cloudinary debe ser **unsigned** (Settings → Upload → Upload
  presets → Signing mode: Unsigned); las `NEXT_PUBLIC_*` se **hornean en el
  build** → marcar en *Production* y **redeployar sin caché**.
- ~~**Activar entrega de PDF/ZIP en Cloudinary**~~ (Settings → Security →
  "Allow delivery of PDF and ZIP files"): **resuelto — toggle activado por
  Julieta y confirmado en vivo el 2026-08-10.** Corrección importante sobre
  el diagnóstico anterior (que quedó escrito acá mismo y era incompleto): la
  subida **firmada** de CV (`POST /uploads/sign-cv`, C.2(b) auditoría de
  producto) **no** resuelve este bug por sí sola — el bloqueo de entrega de
  PDF/ZIP de Cloudinary es una restricción de **toda la cuenta**, no
  depende de si la subida fue firmada o no. Se probó en vivo: un CV recién
  subido con firma seguía dando `ERR_INVALID_RESPONSE` hasta activar este
  toggle del dashboard; con el toggle activado, abre sin volver a subirlo.
  La subida firmada sigue teniendo valor (evita que cualquiera suba
  archivos a la cuenta sin pasar por el backend), pero el toggle es lo que
  de verdad destraba la entrega de PDF — no un fallback, es **el** fix.


## Convenciones de producto/diseño

- Todo en **español**, incluido el texto de cara al usuario.
- Identidad **Design System v5.0** (#345, 2026-09-22): lienzo **off-white
  cálido** `#FBFAF6` / relleno recesado `#F3EFE6`, tarjetas blancas, tinta
  `#111111`, acento **ámbar** `#D97706` (texto sobre claro `#B45309`) y **verde
  bosque** `#1B3A31` como superficie destacada (pago, "Recomendado", "Turnos
  activos"). Tipografía **Fraunces** (títulos de pantalla y de contenido) +
  **Inter** (texto y encabezados de sección) + **DM Mono** (eyebrows y datos).
  Iconografía **Lucide**, sensación de app nativa. Un solo acento ámbar por
  pantalla. Todos los fondos pasan por tokens de `globals.css` (no hay grises
  hardcodeados). **Fuente de verdad: `docs/design-system/color-system.md` y
  `typography.md`**; `docs/design/COLOR_SYSTEM.md` es el registro histórico. El
  isotipo es la **mano ahuecada sobre la oreja**, SVG vectorial final del
  diseñador (ver `frontend/components/Logo.tsx`).
- **Adentro de una tarjeta negra la proporción se invierte.** La regla del "un
  solo acento" se mide sobre el lienzo, que es el 95% de la app; en un
  módulo `bg-night` el contenido va con color (ícono en chip ámbar, moneda
  ámbar, dato en blanco, dato secundario en crema `#F1E7A0`) porque una tarjeta
  negra llena de blancos y grises se apaga. Receta y contrastes medidos:
  `docs/design/COLOR_SYSTEM.md` §3.2.

