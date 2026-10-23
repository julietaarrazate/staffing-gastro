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
  `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` (sin uso desde 2026-10-15: las
  fotos suben firmadas), `NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
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
2. ✅ **`SEED_DEMO_DATA` = `false`** (Render y `render.yaml`, 2026-10-22):
   ya hay usuarios reales, así que se apagó y se purgaron las 26 cuentas
   demo de Neon. Ver `docs/historial/2026-10-22-apagar-datos-demo.md`.
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

> ✅ **`GUEST_ACCESS_PIN`** (Render, cargada por Julieta el 2026-10-10): el PIN
> del acceso invitado ("Explorar sin cuenta"). Hasta esa fecha era una
> constante en el código, pero el repo es público y con ese PIN cualquiera
> entraba como comercio al mapa de trabajadores. **Sin esta var el acceso
> invitado está apagado** (`POST /auth/guest` responde 404 y la pantalla
> muestra "El acceso de invitado no está disponible"). Usar un PIN nuevo de
> 8 o más **dígitos**, sin letras: el campo del login abre el teclado
> numérico (`inputMode="numeric"`) y en el celular no se pueden tipear
> letras. El viejo quedó en la historia de git y no sirve.
> Para cambiarlo alcanza con editar la var (Render redeploya solo).

**Otros pendientes operativos (no env vars):**
- 🟠 **Pasar Render al plan Starter ($7/mes, siempre prendido)** — decidido
  por Julieta el 2026-10-13, para hacerlo **antes de tener usuarios reales**.
  Por qué: en el plan free el servidor se duerme a los 15 minutos sin tráfico.
  Quien entra después espera 30 a 60 s, y mientras duerme **no corre el
  scheduler** (`shift/application/scheduler.py`): no salen los recordatorios
  de llegada, no se amplía la búsqueda de un turno sin cubrir y no se marcan
  ausencias. El backend ya está preparado para que Neon siga en el plan free
  con Render siempre prendido (#429, cierra la conexión ociosa a los 2
  minutos; detalle en `docs/historial/2026-10-13-neon-dormir.md`).
  Pasos: Render → el servicio del backend → Settings → Instance Type →
  **Starter** → guardar (redeploya solo, no hay que tocar env vars).
  Después: durante la primera semana mirar en Neon → Monitoring el consumo de
  cómputo (CU-h). El plan free da 100 CU-h por mes; con el arreglo, la base se
  duerme cuando nadie usa la app. Si en un mes pasa de ~70 CU-h, es momento de
  pasar Neon al plan pago por uso. Estimación (no medida): eso pasa cuando hay
  alguien usando la app unas 13 horas por día, del orden de 80 a 150 personas
  activas por día. Render Starter (512 MB) alcanza para cientos de personas
  usándola a la vez.
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


### 🟠 Cobro mensual con Mercado Pago (ADR-0021) — pendiente de Julieta

El código está listo y **apagado**: sin las dos credenciales de abajo, los
planes se cambian sin pagar, como en la beta. Para prenderlo:

**En Mercado Pago** (con la cuenta de Mercado Pago de Oído):

1. Entrar a <https://www.mercadopago.com.ar/developers/panel/app> → **Crear
   aplicación**. Nombre: **Oído**. Tipo de solución: **Pagos online**, producto
   **Checkout Pro**. Sin plataforma de e-commerce.
2. En la aplicación → **Credenciales de producción** → completar los datos
   del negocio que pida (rubro, sitio `https://www.oido.com.ar`) y activarlas.
   Copiar el **Access Token** de producción (empieza con `APP_USR-`). No
   usar el de prueba (`TEST-`).
3. En la aplicación → **Webhooks** → **Configurar notificaciones** → Modo
   **productivo**:
   - URL: `https://api.oido.com.ar/api/v1/subscription/webhooks/mercadopago`
   - Eventos: tildar sólo **Pagos**.
   - Guardar y copiar la **clave secreta** que muestra esa pantalla.
4. En esa misma pantalla, **Simular** una notificación: tiene que responder
   200 (si responde 401, la clave secreta cargada en Render no es la misma;
   si no llega, revisar que Cloudflare no la esté frenando).
5. Revisar en **Tu negocio → Costos** la comisión vigente de Checkout Pro
   con dinero en cuenta y débito (el ADR-0021 anota 0,8 % + IVA para QR con
   dinero en cuenta al 2026-10-23, a verificar).

**En Render** (servicio del backend → Environment), cargar y guardar
(redeploya solo):

- `MERCADOPAGO_ACCESS_TOKEN` = el Access Token de producción del paso 2.
- `MERCADOPAGO_WEBHOOK_SECRET` = la clave secreta del paso 3.
- Recién cuando quieras que **publicar exija haber pagado**:
  `SUBSCRIPTIONS_ENFORCED=true`. Con las credenciales cargadas y esto en
  `false`, se puede pagar pero nadie queda bloqueado (sirve para probar con
  un comercio propio primero).

**Prueba recomendada antes de exigirlo:** con un comercio propio, elegir
Inicial en `/subscription`, pagar con dinero en cuenta, volver a la app y ver
"Pagado hasta el …"; después "Arrepentirme" y confirmar que llega la
devolución.

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

