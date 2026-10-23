# STATUS.md — Estado vigente de Oído

> **Este archivo es corto a propósito y se edita en el lugar.** Dice qué está
> abierto hoy, nada más. Lo que pasó (qué se hizo, por qué, con qué PR) va en
> [`historial/`](./historial/README.md), **un archivo por cambio**. Antes del
> 2026-10-03 todo vivía acá en un solo archivo de 5.000 líneas: "Qué sigue"
> estaba en la línea 4.400, las sesiones gastaban de 4 a 9 llamadas en
> encontrarla, y el encabezado "Última actualización", que todos los PRs
> reescribían, chocaba en casi todos los merges. Ese archivo quedó congelado
> en [`historial/ARCHIVO-2026-07-a-2026-10-03.md`](./historial/ARCHIVO-2026-07-a-2026-10-03.md).
Si un comentario del código o un doc dice "ver `docs/STATUS.md` <fecha>",
esa entrada está en ese archivo: buscala por la fecha o el número de PR.

**Cómo se mantiene (en el mismo PR del cambio):**

1. Agregá `docs/historial/AAAA-MM-DD-tema.md` con lo que hiciste y por qué
   (plantilla en [`historial/README.md`](./historial/README.md)).
2. Si tu cambio abre o cierra un ítem de abajo, editá ese ítem. Lo resuelto
   **se borra** de esta lista (queda en el historial), no se tacha.
3. No agregues fechas de "última actualización" ni resúmenes de lo hecho a
   este archivo: eso es lo que hacía que dos PRs chocaran siempre.

---

## Qué sigue (estado vigente)

Si arrancás una sesión sin otra instrucción, esto es lo que hay, en orden.
Revisado contra el código y los PRs el 2026-10-03.

1. 🟡 **Paleta celeste (v6) en toda la app** (pedido de Julieta,
   2026-10-08, con violeta; el 2026-10-09 pasó a celeste claro sólo lo que
   era violeta, con el lienzo `#f3f3f3` de la versión del diseñador, y
   volvió al ámbar de siempre `#d97706`, el del logo). Primero en la
   landing; ahora rige en `:root` de `globals.css`, con su versión oscura.
   Desde #412 lleva vidrio esmerilado (cromo translúcido, velo ámbar,
   `bg-glow`) y menos celeste lleno. Falta rehacer el PDF y el paquete del
   diseñador, que siguen en violeta. Detalle en
   [`historial/2026-10-09-paleta-celeste-app.md`](./historial/2026-10-09-paleta-celeste-app.md)
   y [`design-system/color-system.md`](./design-system/color-system.md),
   "Propuesta v6".
2. 🟡 **Llevar el movimiento de la landing a la interfaz de la app**
   (pedido de Julieta, 2026-10-06; sin arrancar). La referencia era la
   landing "la historia de un turno" (#405), reemplazada el 2026-10-12 por
   la landing corta y el 2026-10-18 por la landing "cielo"; sigue viva en `/historia` para grabar reels, con su
   motor de escena en `components/landing/story/useStage.ts`. La trampa de motion 13
   con `sticky` y por qué la landing no se oscurece, en
   [`historial/2026-10-06-landing-historia-de-un-turno.md`](./historial/2026-10-06-landing-historia-de-un-turno.md)
   y [`design-system/motion.md`](./design-system/motion.md).
3. ⏸️ **Identidad de marca, en pausa.** Julieta rechazó las tres
   direcciones propuestas (2026-10-06) y pidió primero la landing. Riesgo
   que sigue en pie: Oído usa serif + mono + crema y un componente "ticket",
   como Bachero; la metáfora propia es el "¡oído!" de la cocina. Desde el
   2026-10-18 la landing la usa: celeste y blanco con el ámbar, y una comanda
   con filete porteño que se canta "¡Oído!". Contexto:
   [`historial/ARCHIVO…`](./historial/ARCHIVO-2026-07-a-2026-10-03.md), sección
   "Ideas de la competencia (2026-10-02)", y
   [`design-system/brand-foundation.md`](./design-system/brand-foundation.md).
4. 🟡 **Landing "cielo": fotos propias y prueba real** (2026-10-18). La
   rueda del inicio y la oferta usan fotos de banco (dominio público/CC0,
   de otros países); hay que reemplazarlas por fotos de locales porteños
   (`frontend/public/landing/`). Cuando haya locales usando Oído, sumar una
   cita corta con nombre. Detalle en
   [`historial/2026-10-18-landing-cielo.md`](./historial/2026-10-18-landing-cielo.md).
5. 🟡 **"Datos del comercio" muestra la dirección tres veces**: en el
   buscador, en el campo Dirección y en "Ubicación" (`/profile/edit`, rol
   comercio). Quedó anotado al cerrar la simplificación del Perfil (#396).
6. 🟢 **Subir Node de 22 a 24**, sin apuro (Node 22 tiene soporte hasta
   abril de 2027). **Vercel ya corre 24.x** (visto en la config del
   proyecto el 2026-10-10), así que hoy CI prueba con una versión distinta
   de la que corre en producción. Faltan `node-version` en
   `.github/workflows/ci.yml` y `@types/node` en `frontend/package.json`.
   Dependabot tiene ignoradas las subas mayores de `@types/node` (#375) para
   que los tipos no se adelanten a la versión que corre.
7. 🟠 **Cobro real de la suscripción** (pedido de Julieta, 2026-10-22: sin
   plan gratis, ADR-0020; hoy el cobro está apagado y el plan Inicial queda
   activo sin pagar). Falta: webhook de Mercado Pago que active el plan al
   confirmarse el pago, estado "pendiente" guardado, bloquear la publicación
   hasta el primer pago, `back_url` del checkout a `oido.com.ar` (hoy
   `staffya.com`), y botón de baja y de arrepentimiento en `/subscription`.
   Necesita la cuenta de Mercado Pago de Julieta (`MERCADOPAGO_ACCESS_TOKEN`).
8. ⏸️ **Post-beta, a propósito:** pago al trabajador y facturación dentro de
   la app (lo que tienen todos los competidores grandes), passkeys (diseñado
   en [`reference/ACCESO_MODERNO.md`](./reference/ACCESO_MODERNO.md), Feature
   3), WhatsApp Business API y R4 (Redis, multi-ciudad, OSRM) recién con
   tráfico real.
9. 🟠 **Auditoría del 2026-10-10: lo que queda.** Cerrados lo de privacidad
   (#416), las carreras sobre el turno más la idempotencia (#417) y el token
   de sesión del frontend ("Va en camino", formularios que se recargaban,
   401 sin reintento, #419), Google sobre cuenta sin verificar y
   `ADMIN_EMAILS` sin verificación. La lista completa está en
   [`historial/2026-10-10-auditoria-privacidad.md`](./historial/2026-10-10-auditoria-privacidad.md).
   Sigue: el **rate limit detrás del proxy de Render** (usa la IP del proxy,
   así que es global; falta confirmar qué header de IP es confiable en
   Render antes de tocarlo, ver el historial de autenticación); después, los
   de dominio y los menores.
10. 🟠 **Mudar el frontend de Vercel a Cloudflare Workers** antes de la
   beta comercial (Vercel Hobby no permite uso comercial; ADR-0017,
   propuesto). Etapa 1, prueba de compatibilidad: hecha (#428). Etapa 2,
   auditoría de seguridad del frontend publicado: hecha; lo chico se arregló
   y lo pendiente está en un documento privado de Julieta (el repo es
   público), ver
   [`historial/2026-10-14-auditoria-seguridad-frontend.md`](./historial/2026-10-14-auditoria-seguridad-frontend.md).
   Etapa 3, endurecimiento (backend sólo por Cloudflare, IP real para el
   límite de intentos, Turnstile): **prendida en producción el 2026-10-15**
   ([`historial/2026-10-15-etapa3-prendida.md`](./historial/2026-10-15-etapa3-prendida.md);
   ADR-0018). Falta sólo el HSTS de la zona (paso 7 del runbook). Etapa 4,
   publicación de prueba: hecha
   ([`historial/2026-10-19-etapa4-workers-dev.md`](./historial/2026-10-19-etapa4-workers-dev.md)).
   **Etapa 5, cambio de DNS: hecho el 2026-10-19.** `www.oido.com.ar` y
   `oido.com.ar` los sirve el Worker en Workers Paid
   ([`historial/2026-10-19-etapa5-dns-a-cloudflare.md`](./historial/2026-10-19-etapa5-dns-a-cloudflare.md)).
   Vercel quedó retirado el mismo día
   ([`historial/2026-10-19-chau-vercel.md`](./historial/2026-10-19-chau-vercel.md)).
   Queda sólo el HSTS de la zona, en unas semanas.

   Detalle en
   [`historial/2026-10-13-cloudflare-prueba-compatibilidad.md`](./historial/2026-10-13-cloudflare-prueba-compatibilidad.md)
   y [`reference/DEPLOY.md`](./reference/DEPLOY.md).

11. 🟠 **Cubrir el turno en minutos: propuesta para pulir** (pedido de
    Julieta, 2026-10-14). Lo primero es sacar el backend de Render free
    (se duerme a los 15 min y con él el scheduler de la escalada); después,
    "el primero que toma" para urgentes, cascada por tandas y verificación
    de identidad gratis. Nada decidido:
    [`planning/PROPUESTA_COBERTURA_URGENTE.md`](./planning/PROPUESTA_COBERTURA_URGENTE.md).
12. 🔴 **Revisión de seguridad del 2026-10-20** (pedido de Julieta: "todas
   por prioridad"). Un PR por tema; al cerrar uno, borrarlo de esta lista.
   Origen en
   [`historial/2026-10-20-revision-seguridad-clave-gemini.md`](./historial/2026-10-20-revision-seguridad-clave-gemini.md).
   - **Clave de Gemini en Sentry y token del WebSocket en los logs:** el
     código ya no manda la clave en la URL, Sentry filtra secretos y los logs
     de uvicorn tapan `?token=`. Falta lo de Julieta: rotar la clave y borrar
     `STAFFYA-BACKEND-7` (ver "Pendiente de Julieta").
   - **Alta — distancia exacta en `/matching/search`**
     (`modules/matching/application/services.py`): el pin se desplaza pero
     `distance_km` sale exacto. Devolverla redondeada en bandas.
   - **Media — `cv_url` visible para cualquier usuario autenticado**
     (`modules/worker/api/routes.py`, `schemas.py`): mostrarlo sólo al
     dueño, a admin o a un comercio con postulación/asignación.
   - **Media — suscripción push** (`modules/notification/`): validar que el
     `endpoint` sea `https` de un servicio push conocido, `timeout` en
     `webpush`, y que el `DELETE` filtre por usuario.
   - **Media — cuota de Gemini:** tope global diario además del de usuario,
     y email verificado para usar la IA (`modules/assistant/api/routes.py`,
     `modules/shift/api/routes.py`).
   - **Media — documentos de identidad en Cloudinary con entrega pública**
     (`core/cloudinary.py`). **Espera decisión de Julieta:** el arreglo de
     verdad es subirlos `private` y que el panel de admin pida un link de
     descarga que vence (API de Cloudinary). Toca la subida, lo que se
     guarda, el panel de verificación y los archivos ya subidos. Hoy el
     nombre de cada archivo es al azar (128 bits), así que el riesgo es que
     se filtre un link, no que lo adivinen.
   - **Baja:** emails en logs (`notification/infrastructure/*email_sender.py`,
     `admin/`), login sin hash de relleno si el email no existe y sin límite
     por cuenta (`identity/`), `DELETE /push/subscribe` sin dueño (va con el
     de push), CSP con `unsafe-inline`.
   - **Limpieza chica:** `frontend/.env.production`, `frontend/lib/api.ts` y
     `frontend/next.config.ts` siguen con `staffya-backend.onrender.com`
     como valor por defecto. En producción no afecta, porque Workers Builds
     inyecta `NEXT_PUBLIC_API_URL=https://api.oido.com.ar/api/v1`. Pero si
     esa variable faltara, el frontend llamaría a una API que responde 403.
     El límite de intentos con IP real ya está (etapa 3, 2026-10-15).

Deuda técnica priorizada: [`TECH_DEBT.md`](./TECH_DEBT.md). Bugs que ya
pasaron y no hay que reintroducir: [`BUGS.md`](./BUGS.md).

## Pendiente de Julieta (operativo, no es código)

- **Prender las vistas previas por PR en Cloudflare:** Workers & Pages →
  `oido-frontend` → Settings → Build, activar los builds de ramas que no son
  de producción con el comando `npx wrangler preview`
  ([`DEPLOY.md`](./reference/DEPLOY.md), "Vistas previas por PR").
- **Rotar la clave de Gemini** (estuvo expuesta en Sentry): clave nueva en
  Google AI Studio, borrar la vieja, cargarla en Render (`GEMINI_API_KEY`) y
  **borrar** el error `STAFFYA-BACKEND-7` en Sentry. Ver ítem 13.
- **Inscribir la base en el Registro Nacional de Bases de Datos** (AAIP).
- **Confirmar** en Render `ENVIRONMENT=production` (controla la cookie del
  refresh token, TECH_DEBT S1) y `GEMINI_API_KEY` (sin ella, "Describí el
  turno" y el asistente responden 503 con un mensaje claro).
- **Ensayar un restore de Neon** antes de depender del backup con usuarios
  reales.
- **Confirmar tres afirmaciones del video "historia de marca"** antes de
  publicarlo: "este año en Palermo", "nace en Buenos Aires" y el "¡oído!" de
  cocina como origen del nombre (`marketing/videos/historia-de-marca.md`).
- **Fotos reales para el seed** (R2.5, cuenta de Cloudinary del proyecto).
- **DNDA:** expediente presentado el 2026-09-23, se espera respuesta. El PR
  #310 queda en draft y no se mergea (lleva su DNI).

El detalle de cada env var, y cuáles ya están cargadas, está en `CLAUDE.md`,
"Pendiente de la operadora".

## Decisiones vigentes

- **Cierre de un PR:** CI y Security en verde en GitHub → captura en claro y
  oscuro si toca UI → el "sí" de Julieta → squash. Ver `CLAUDE.md`.
- **Cada pantalla responde una sola pregunta** (2026-09-28). Es la regla con
  la que se recortaron Inicio (#393), el Panel del comercio (#395) y el
  Perfil (#396); lo que sobra va a una pantalla propia, no a un acordeón.
- **Design system v5.0** (#345): Fraunces + Inter + DM Mono, que siguen.
  Su color (ámbar `#D97706`, verde bosque) quedó reemplazado por la paleta
  celeste (v6) el 2026-10-09. La fuente de verdad es
  [`design-system/`](./design-system/README.md); `design/COLOR_SYSTEM.md` y
  `design/TYPOGRAPHY_SYSTEM.md` son históricos.
- **La app no se oscurece sola.** "Sistema" resuelve a claro; el oscuro es
  elección explícita.
- **`quantity` = 1** por turno (ADR-0003). Multi-asignación, sólo con un ADR
  nuevo.
- **Pagos con Mercado Pago diferidos por decisión de Julieta** (2026-08-15):
  la beta cobra fuera de la app y se marca pagado
  (`POST /shifts/{id}/mark-paid`).
- **Infraestructura nueva o cambio de arquitectura = ADR nuevo**
  (`docs/adr/ADR-00NN-*.md`).

## Dónde está cada cosa

| Busco… | Está en |
|---|---|
| Qué pantalla hace qué y qué código toca | [`reference/MAPA_DEL_CODIGO.md`](./reference/MAPA_DEL_CODIGO.md) |
| Cómo correr tests, Playwright y capturas en una sesión cloud | [`reference/SESION_CLOUD.md`](./reference/SESION_CLOUD.md) |
| Por qué se hizo algo | [`historial/`](./historial/README.md) y `docs/adr/` |
| Módulos del backend y sus prefijos | [`foundation/MODULES.md`](./foundation/MODULES.md) |
| Dominio (turno, estados, reputación) | [`foundation/DOMAIN.md`](./foundation/DOMAIN.md) |
| Colores, tipografía, sombras | [`design-system/`](./design-system/README.md) |
| Deploy, env vars, runbooks | [`reference/DEPLOY.md`](./reference/DEPLOY.md) |
| Plan de lanzamiento | [`planning/LAUNCH_PLAN.md`](./planning/LAUNCH_PLAN.md) |
