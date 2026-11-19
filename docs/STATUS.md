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

- 🔴 **Salida a beta (etapa 3 cerrada el 2026-11-17).** De lo que quedó
  «para revisar con Fable», el 2026-11-18 entraron G4, U081, U072, la
  segunda mirada a G6, los dos arreglos chicos de la baja del dispositivo y
  del panel sin mapa, U080 (turno reofrecido) y las decisiones 21, 22 y 24.
  La pasada por clase de error se auditó el 2026-11-19: los arreglos van por
  grupo, con su estado en el tablero («Pasada por clase de error»). Después,
  P1 a P5. La próxima migración libre es la 0059. En paralelo, las
  etapas 4 (marca) y 5 (lista de salida, con M7). Antes de encender el
  cobro: la regla de cambio de plan que decidió Julieta, con U140, U142 y
  U143. Antes del 17/12: revisar la excepción de picomatch (#612).
  Qué está hecho,
  qué está en curso, qué falta y qué espera una decisión de Julieta, fila por
  fila, en [`planning/BETA_TABLERO.md`](./planning/BETA_TABLERO.md). Es lo
  primero que se lee y lo que se edita en cada PR de la beta.

0. 🟡 **Marca: Shrikhand e ícono «el pinche con oído» (beta, etapa 4).** Julieta eligió el
   2026-11-17 la letra Shrikhand y seguir con el ámbar. El 2026-11-18 eligió,
   después de ver cinco conceptos (https://claude.ai/artifact/TqfGBkrBX1aGFJSygrsQkS),
   el ícono **«el pinche con oído»** (la comanda clavada en el pinche, con
   «oído» en el papel; «o» sola de 48 px para abajo), sólo como ícono de la
   app: **ya está en el código** (íconos grandes, maskable, favicon, silueta y
   los vectores `isotipo-pinche*` de `design-system/marca/`;
   [historial](./historial/2026-11-18-icono-pinche-oido.md)). Falta, opcional,
   decidir si se encarga a un fileteador y regenerar el manual en PDF, que
   sigue con el «oí». La app, la landing,
   la miniatura, los vectores y el manual en PDF de
   `design-system/marca/` y el brand system navegable ya están
   ([historial](./historial/2026-11-17-marca-shrikhand-isotipo-oi.md)). **Los
   adornos del «oído» fileteado tienen cuerpo** desde el 2026-11-18 (Julieta:
   los de línea fina «quedaron demasiado finos»): nivel «medio» en el final
   de la landing y la bienvenida, «cargado» en la miniatura; entran el rojo y
   el rosa sólo en las flores del filete y la letra sigue crema con relieve
   azul hondo ([historial](./historial/2026-11-18-filete-adornos-con-cuerpo.md)).
   Queda por decidir si un toque de ese filete va también en el ícono del
   pinche (Julieta: «quizás»; iría en un PR aparte). Sigue
   **la dirección «con relieve»** (Julieta eligió
   seguirla: la sombra dura azul hondo del filete como profundidad de la
   interfaz; prueba en https://claude.ai/artifact/WNXBXhkNgGrFdBbqFNsQan).
   La **segunda prueba de la landing** (2026-11-18) tiene tres direcciones
   para comparar, «El pase», «El bodegón» y «Un servicio en vivo»
   (https://claude.ai/artifact/VWPZtN8eAvxk5U2kVuE3zR). Julieta no eligió
   ninguna: pidió un **híbrido de la landing publicada** (el cielo y la rueda
   de fotos) con la letra de brocha, el isotipo nuevo y los planes como
   carta (https://claude.ai/artifact/9Bq2jU9LK7xaCj6b4T2Bxz). La prueba de
   la app se rehízo con el mismo criterio (el turno como comanda, el panel
   como riel, los pasos tachados a mano:
   https://claude.ai/artifact/MEN8VhUv43HM2sE9pH6kmF). Julieta eligió la
   **letra mixta** (brocha en el inicio, el cierre y la carta; Abril Fatface
   en los títulos de sección). **El híbrido ya está en el código de la
   landing** (letra mixta, botones con relieve, los planes como carta con
   pizarra, mapa sin reloj, final de cielo con el «oído» entero y sólo lo
   legal debajo, sin el Sol de Mayo; tokens del
   relieve y ADR-0027;
   [historial](./historial/2026-11-18-landing-hibrida.md)). **La app va
   pantalla por pantalla**, un PR cada una, sin tocar la lógica (Julieta,
   2026-11-18). Hecho: el Inicio del trabajador
   ([historial](./historial/2026-11-18-inicio-trabajador-relieve.md)) y el
   Panel del comercio
   ([historial](./historial/2026-11-18-panel-comercio-relieve.md)),
   Candidatos ([historial](./historial/2026-11-18-candidatos-relieve.md)) y
   Mis turnos ([historial](./historial/2026-11-18-mis-turnos-relieve.md)).
   **Sigue** lo que es de toda la app, cada cosa en su PR y en este orden:
   ~~la barra de abajo~~ (hecha el 2026-11-19,
   [historial](./historial/2026-11-19-barra-de-abajo-relieve.md)), ~~las
   pestañas~~ (hechas el 2026-11-19, con la raya azul hondo;
   [historial](./historial/2026-11-19-pestanas-relieve.md)), ~~los botones
   secundarios~~ (hechos el 2026-11-19, rectos y planos;
   [historial](./historial/2026-11-19-botones-secundarios-relieve.md)), ~~los
   pasos tachados a mano~~ (hechos el 2026-11-19, en un renglón;
   [historial](./historial/2026-11-19-pasos-tachados.md)), ~~los colores de
   los sellos~~ (hechos el 2026-11-19;
   [historial](./historial/2026-11-19-colores-de-los-sellos.md)) y ~~el
   detalle del turno~~ (hecho el 2026-11-19, el pago en la comanda;
   [historial](./historial/2026-11-19-detalle-del-turno-comanda.md)). Cómo
   va cada uno lo decidió Julieta el 2026-11-19 (`direccion-relieve.md`).
   **Sigue (Julieta, 2026-11-19: «las otras pantallas, Buscar por ejemplo,
   siguen igual»): el resto de las pantallas**, un PR cada una. Orden
   propuesto, a confirmar con ella: Buscar del trabajador (`/buscar`, con
   `OpportunityCard`, que también usan la grilla del Inicio en compu y
   «Descubrir rápido»), Buscar del comercio (`/search`), Publicar turno,
   Chats, Perfil (los dos roles), Mapa, las fichas (comercio y trabajador),
   Favoritos, Mi plan, y el ingreso, el alta y la bienvenida.
   Queda, de lo que no entró en estos PRs: el encabezado de la app sigue de
   vidrio, «Agregar a favoritos» de la ficha de quien trabaja se parte en dos
   renglones en el celular, y el aviso de error (`Toast`) usa el rojo de base
   con letra blanca (3,8). Las piezas compartidas ya están
   (`components/ui/Comanda.tsx`, `lib/letras.ts`, `.app-cielo`). Qué tiene, las referencias de Julieta,
   lo que falta decidir y el orden, en
   [`design-system/direccion-relieve.md`](./design-system/direccion-relieve.md).
Revisado contra el código y los PRs el 2026-10-03.

1. 🟡 **Paleta celeste (v6) en toda la app** (pedido de Julieta,
   2026-10-08, con violeta; el 2026-10-09 pasó a celeste claro sólo lo que
   era violeta, con el lienzo `#f3f3f3` de la versión del diseñador, y
   volvió al ámbar de siempre `#d97706`, el del logo). Primero en la
   landing; ahora rige en `:root` de `globals.css`, con su versión oscura.
   Desde #412 lleva vidrio esmerilado (cromo translúcido, velo ámbar,
   `bg-glow`) y menos celeste lleno. El PDF y el paquete del diseñador se
   rehicieron el 2026-11-17 (ítem 0). Detalle en
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
3. 🟡 **Landing "cielo": fotos propias y prueba real** (2026-10-18). La
   rueda del inicio y la oferta usan fotos de banco (dominio público/CC0,
   de otros países); hay que reemplazarlas por fotos de locales porteños
   (`frontend/public/landing/`): qué foto va en cada lugar, con tamaño,
   encuadre y permisos, en
   [`design-system/fotos-landing.md`](./design-system/fotos-landing.md).
   Cuando haya locales usando Oído, sumar una cita corta con nombre. Detalle en
   [`historial/2026-10-18-landing-cielo.md`](./historial/2026-10-18-landing-cielo.md).
4. 🟡 **"Datos del comercio" muestra la dirección tres veces**: en el
   buscador, en el campo Dirección y en "Ubicación" (`/profile/edit`, rol
   comercio). Quedó anotado al cerrar la simplificación del Perfil (#396).
5. 🟢 **Subir Node de 22 a 24**, sin apuro (Node 22 tiene soporte hasta
   abril de 2027). **Vercel ya corre 24.x** (visto en la config del
   proyecto el 2026-10-10), así que hoy CI prueba con una versión distinta
   de la que corre en producción. Faltan `node-version` en
   `.github/workflows/ci.yml` y `@types/node` en `frontend/package.json`.
   Dependabot tiene ignoradas las subas mayores de `@types/node` (#375) para
   que los tipos no se adelanten a la versión que corre.
6. 🟠 **Cobro real de la suscripción** — **código listo, apagado**
   (ADR-0022, 2026-10-23): un pago por mes con Checkout Pro de Mercado Pago,
   sin débito automático ni tarjeta de crédito; webhook firmado que acredita
   30 días, estado "pendiente", bloqueo al publicar sin mes pago, avisos de
   vencimiento, "Dar de baja" y "Arrepentirme" (reembolso) en
   `/subscription`. **Falta de Julieta:** crear la app "Oído" en Mercado
   Pago, cargar `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` en
   Render, probar con un comercio propio y recién ahí
   `SUBSCRIPTIONS_ENFORCED=true` (pasos en
   [`reference/PENDIENTE_OPERATIVO.md`](./reference/PENDIENTE_OPERATIVO.md),
   "Cobro mensual con Mercado Pago"). Decidir qué hacer con los comercios de
   la beta que hoy publican sin pagar cuando se exija (quedan bloqueados
   hasta su primer pago). Para los **fundadores** ya está decidido
   (2026-11-18): sin cargo hasta el 28/2 y después precio congelado 12
   meses, así que antes de exigir el pago tienen que quedar eximidos.
7. ⏸️ **Post-beta, a propósito:** pago al trabajador y facturación dentro de
   la app (lo que tienen todos los competidores grandes), passkeys (diseñado
   en [`reference/ACCESO_MODERNO.md`](./reference/ACCESO_MODERNO.md), Feature
   3), WhatsApp Business API y R4 (Redis, multi-ciudad, OSRM) recién con
   tráfico real.
8. 🟠 **Auditoría del 2026-10-10: lo que queda.** Cerrados lo de privacidad
   (#416), las carreras sobre el turno más la idempotencia (#417) y el token
   de sesión del frontend ("Va en camino", formularios que se recargaban,
   401 sin reintento, #419), Google sobre cuenta sin verificar y
   `ADMIN_EMAILS` sin verificación. La lista completa está en
   [`historial/2026-10-10-auditoria-privacidad.md`](./historial/2026-10-10-auditoria-privacidad.md).
   Sigue: el **rate limit detrás del proxy de Render** (usa la IP del proxy,
   así que es global; falta confirmar qué header de IP es confiable en
   Render antes de tocarlo, ver el historial de autenticación); después, los
   de dominio y los menores.
9. 🟠 **Mudar el frontend de Vercel a Cloudflare Workers** antes de la
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

10. 🟠 **Cubrir el turno en minutos: propuesta para pulir** (pedido de
    Julieta, 2026-10-14). Lo primero es sacar el backend de Render free
    (se duerme a los 15 min y con él el scheduler de la escalada): **decidido
    el 2026-11-18, Render Starter antes del piloto**; después,
    "el primero que toma" para urgentes, cascada por tandas y verificación
    de identidad gratis. Nada decidido:
    [`planning/PROPUESTA_COBERTURA_URGENTE.md`](./planning/PROPUESTA_COBERTURA_URGENTE.md).
11. 🔴 **Revisión de seguridad del 2026-10-20** (pedido de Julieta: "todas
   por prioridad"). Un PR por tema; al cerrar uno, borrarlo de esta lista.
   Origen en
   [`historial/2026-10-20-revision-seguridad-clave-gemini.md`](./historial/2026-10-20-revision-seguridad-clave-gemini.md).
   - **Clave de Gemini en Sentry y token del WebSocket en los logs:** el
     código ya no manda la clave en la URL, Sentry filtra secretos y los logs
     de uvicorn tapan `?token=`. Falta lo de Julieta: rotar la clave y borrar
     `STAFFYA-BACKEND-7` (ver "Pendiente de Julieta").
   - **Media — cuota de Gemini:** tope global diario además del de usuario,
     y email verificado para usar la IA (`modules/assistant/api/routes.py`,
     `modules/shift/api/routes.py`).
   - **Baja:** CSP con `unsafe-inline`. (La distancia de `/matching/search`,
     el `cv_url`, la suscripción push, los emails en los logs y el login sin
     hash de relleno ya estaban resueltos en el código: lo confirmó la pasada
     de privacidad del 2026-11-19.)
   - **Limpieza chica:** `frontend/.env.production`, `frontend/lib/api.ts` y
     `frontend/next.config.ts` siguen con `staffya-backend.onrender.com`
     como valor por defecto. En producción no afecta, porque Workers Builds
     inyecta `NEXT_PUBLIC_API_URL=https://api.oido.com.ar/api/v1`. Pero si
     esa variable faltara, el frontend llamaría a una API que responde 403.
     El límite de intentos con IP real ya está (etapa 3, 2026-10-15).
12. 🟢 **Rendimiento: lo que quedó abierto** (pasada medida del 2026-11-19;
    método, números y medidores en
    [`reference/RENDIMIENTO.md`](./reference/RENDIMIENTO.md)). Decisión de
    Julieta: el mapa chico de cada turno aceptado en Mis turnos baja maplibre
    (~1 MB) al abrir la pantalla; se evita mostrándolo al tocar o como
    imagen estática. Código: `/matching/search` filtra y ordena en Python
    sobre el punto desplazado (ADR-0014, va con el ítem de la distancia
    exacta de arriba) y `/admin/stats` gasta ~140 ms en Python con volumen.
    Falta mirar Sentry (no estaba conectado en la sesión).

Deuda técnica priorizada: [`TECH_DEBT.md`](./TECH_DEBT.md). Bugs que ya
pasaron y no hay que reintroducir: [`BUGS.md`](./BUGS.md).

## Pendiente de Julieta (operativo, no es código)

- **Estrategia de crecimiento, fase 2 (plan de 90 días):** está en el mismo
  documento privado, una pestaña por entregable
  (https://claude.ai/artifact/CbFduaLLSNXNkgTq1EYFrk). **Decidido el
  18/11** (pestaña Plan de 90 días, «Lo que decidiste para arrancar»): los
  **comercios fundadores** (5 a 8) no pagan hasta el **28/2** y después
  tienen el plan que elijan a **precio congelado por 12 meses**; **Villa
  Crespo** entra en la lista de barrios a evaluar, segundo en el orden; la
  **consulta legal** (laboral y de datos personales) la hace gratis una
  abogada amiga; y el backend pasa a **Render Starter** (USD 7 por mes)
  antes del piloto, con todo lo demás en $0. Falta de Julieta: hacer la
  consulta con el cuestionario de la pestaña Lanzamiento de beta (antes del
  4/12) y contratar Render Starter antes del piloto. Del lado del código, el
  origen de cada alta ya se guarda y se ve en Administración → Métricas,
  «Altas por origen» (enlaces con `?ref=`, `utm_source` y `utm_campaign`;
  [historial](./historial/2026-11-18-origen-de-cada-alta.md)); falta la
  serie semanal M7 del tablero
  ([`historial/2026-11-18-plan-90-dias-growth.md`](./historial/2026-11-18-plan-90-dias-growth.md),
  [`historial/2026-11-18-decisiones-fase-0.md`](./historial/2026-11-18-decisiones-fase-0.md)).
- **Verificación en dos pasos del admin (ADR-0023):** **antes del merge**,
  generar `TWO_FACTOR_ENCRYPTION_KEY` y cargarla en Render (sin ella el
  panel de admin queda cerrado); **apenas se deploya**, entrar y activarla en
  Administración → Seguridad, y guardar los 10 códigos de recuperación fuera
  del celular. Pasos en
  [`reference/PENDIENTE_OPERATIVO.md`](./reference/PENDIENTE_OPERATIVO.md),
  "Verificación en dos pasos del admin".
- **Sol de Mayo en la marca:** antes de registrar la marca con el sol del
  final de la landing, confirmar con la asesoría legal el uso de símbolos
  nacionales ([`historial/2026-10-23-landing-filete-cartel.md`](./historial/2026-10-23-landing-filete-cartel.md)).
- **Prender las vistas previas por PR en Cloudflare:** Workers & Pages →
  `oido-frontend` → Settings → Build, activar los builds de ramas que no son
  de producción con el comando `npx wrangler preview`
  ([`DEPLOY.md`](./reference/DEPLOY.md), "Vistas previas por PR").
- **Rotar la clave de Gemini** (estuvo expuesta en Sentry): clave nueva en
  Google AI Studio, borrar la vieja, cargarla en Render (`GEMINI_API_KEY`) y
  **borrar** el error `STAFFYA-BACKEND-7` en Sentry. Ver ítem 13.
- **Documentos de identidad (ADR-0021), después del merge:** cargar
  `CLOUDINARY_CLOUD_NAME` en Render (mismo valor que el de Vercel; sin ella
  tampoco se borran los documentos al decidir) y correr una vez
  `python -m scripts.privatize_identity_evidence` (mira) y después con
  `--apply` (privatiza los pendientes y **borra** los DNI/constancias de
  claims ya decididos). Comando completo en
  [`PENDIENTE_OPERATIVO.md`](./reference/PENDIENTE_OPERATIVO.md), ítem 5b.
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
