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
   (pedido de Julieta, 2026-10-06; sin arrancar). La referencia es la
   landing nueva, "la historia de un turno" (#405): motor de escena en
   `frontend/components/landing/story/useStage.ts`, la trampa de motion 13
   con `sticky` y por qué la landing no se oscurece, en
   [`historial/2026-10-06-landing-historia-de-un-turno.md`](./historial/2026-10-06-landing-historia-de-un-turno.md)
   y [`design-system/motion.md`](./design-system/motion.md).
3. ⏸️ **Identidad de marca, en pausa.** Julieta rechazó las tres
   direcciones propuestas (2026-10-06) y pidió primero la landing. Riesgo
   que sigue en pie: Oído usa serif + mono + crema y un componente "ticket",
   como Bachero; la metáfora propia es el "¡oído!" de la cocina. Contexto:
   [`historial/ARCHIVO…`](./historial/ARCHIVO-2026-07-a-2026-10-03.md), sección
   "Ideas de la competencia (2026-10-02)", y
   [`design-system/brand-foundation.md`](./design-system/brand-foundation.md).
4. 🟡 **"Datos del comercio" muestra la dirección tres veces**: en el
   buscador, en el campo Dirección y en "Ubicación" (`/profile/edit`, rol
   comercio). Quedó anotado al cerrar la simplificación del Perfil (#396).
5. 🟢 **Subir Node de 22 a 24**, sin apuro (Node 22 tiene soporte hasta
   abril de 2027). Son tres cambios juntos: la versión de Node en Vercel
   (Settings → Node.js Version), `node-version` en
   `.github/workflows/ci.yml` y `@types/node` en `frontend/package.json`.
   Dependabot tiene ignoradas las subas mayores de `@types/node` (#375) para
   que los tipos no se adelanten a la versión que corre.
6. ⏸️ **Cuando se active el cobro real de la suscripción** (hoy apagado,
   ADR-0005): `/subscription` necesita botón de baja y de arrepentimiento,
   que los términos ya prometen por mail o soporte.
7. ⏸️ **Post-beta, a propósito:** pago al trabajador y facturación dentro de
   la app (lo que tienen todos los competidores grandes), passkeys (diseñado
   en [`reference/ACCESO_MODERNO.md`](./reference/ACCESO_MODERNO.md), Feature
   3), WhatsApp Business API y R4 (Redis, multi-ciudad, OSRM) recién con
   tráfico real.
8. 🟠 **Auditoría del 2026-10-10: lo que queda.** Cerrados lo de privacidad
   (#416) y las carreras sobre el turno más la idempotencia (ver
   [`historial/2026-10-10-auditoria-privacidad.md`](./historial/2026-10-10-auditoria-privacidad.md),
   que tiene la lista completa). Sigue, en orden: en el frontend, "Va en
   camino" que deja de enviar al vencer el token y formularios que se
   recargan con cada refresh; después, los ajustes de autenticación.

Deuda técnica priorizada: [`TECH_DEBT.md`](./TECH_DEBT.md). Bugs que ya
pasaron y no hay que reintroducir: [`BUGS.md`](./BUGS.md).

## Pendiente de Julieta (operativo, no es código)

- **Cargar `GUEST_ACCESS_PIN` en Render** con un PIN nuevo de 8 o más
  caracteres. Mientras no esté, "Explorar sin cuenta" está apagado (ver
  [`reference/PENDIENTE_OPERATIVO.md`](./reference/PENDIENTE_OPERATIVO.md)).
- **Inscribir la base en el Registro Nacional de Bases de Datos** (AAIP).
- **Antes de abrir la beta con gente real:** `SEED_DEMO_DATA=false` en
  Render y purgar las cuentas demo (runbook en
  [`reference/DEPLOY.md`](./reference/DEPLOY.md)). Hoy está en `true` a
  propósito para que la app se vea poblada.
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
