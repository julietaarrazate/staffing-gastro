# DUE_DILIGENCE_REPORT.md — Auditoría técnica externa (CTO / seguridad / inversor)

> Encargo: "Actuá como un socio técnico de Y Combinator que debe decidir si
> invertiría en este proyecto. Revisá el repositorio completo desde el punto
> de vista de un CTO, un auditor de seguridad y un inversor técnico. Indicá
> todo lo que todavía impediría recomendar Oído para producción o para una
> due diligence técnica." Informe únicamente — **sin cambios de código**.
> Toda afirmación está respaldada con evidencia verificable en el propio
> repositorio (archivo:línea, comando corrido, o cita de un documento interno
> ya existente) al momento de escribir esto (2026-08-04).

## Veredicto ejecutivo

**El código es mejor que el negocio.** La arquitectura, la disciplina de
testing y la documentación están a un nivel que no es habitual en una etapa
pre-seed. Pero eso no es lo que frena una inversión: lo que la frena es que
**el producto todavía no probó, con dinero y usuarios reales, la única cosa
que importa** — que un comercio publique un turno, un trabajador lo cubra, y
alguien pague por eso. Todo lo demás (seguridad endurecida, performance,
observabilidad) es preparación para un evento que, según la propia
documentación del proyecto, **todavía no ocurrió**.

No es un "no invertiría" categórico — es un **"no todavía, y no por el
código"**. La recomendación concreta: la due diligence técnica pasa; la
due diligence de **tracción** no tiene con qué evaluarse porque no hay
datos. Ver el plan de remediación priorizado al final.

---

## Hallazgos críticos (bloquean due diligence o producción real)

### C1 — Cero validación con usuarios y dinero reales

**Evidencia:** `docs/planning/LAUNCH_PLAN.md` (2026-07-02, el propio doc
interno de re-baseline) dice textualmente: *"Lo único entre hoy y la beta...
Apagar `SEED_DEMO_DATA` y purgar cuentas demo el día que entren usuarios
reales"* — es decir, a esa fecha la beta **todavía no había arrancado**.
`docs/STATUS.md` línea 620 documenta el launch-gate (#88) como el cierre de
**"3 lazos construidos-pero-nunca-validados"** — el propio equipo (yo, en
sesiones anteriores) califica el ciclo completo turno→postulación→
asignación→check-in→check-out→reseña→reputación como *nunca validado con un
caso real*, sólo con un test de integración sintético
(`tests/test_full_shift_lifecycle.py`). Un `grep` de "onboarde"/"comercio
real"/"primer comercio" en todo `docs/STATUS.md` (la bitácora completa del
proyecto) no devuelve **ningún** resultado. `render.yaml` sigue con
`SEED_DEMO_DATA: "true"` en la config declarada.

**Por qué importa:** cualquier métrica de este repo (tiempo de cobertura
<10 min, tasa de matching, eficacia del sistema de reputación) es teórica.
Un inversor no puede evaluar tracción, retención ni disposición a pagar
porque no existen. Este es el hallazgo #1, y no lo resuelve ningún cambio de
código — es puramente operativo (conseguir los primeros comercios reales).

### C2 — La monetización está apagada por diseño

**Evidencia:** `backend/app/core/config.py:94`:
`subscriptions_enforced: bool = False` (default). Usado en
`shift/application/services.py:341` (`if settings.subscriptions_enforced:`)
para decidir si el tope del plan del comercio se hace cumplir. Está en
`False` en producción (confirmado en `CLAUDE.md`: *"enforcement OFF por
default: se cuenta el uso pero no se bloquea a nadie en la beta"*).
Adicionalmente, `MercadoPagoSuscripcionAdapter`
(`backend/app/modules/subscription/infrastructure/mercadopago_adapter.py`)
existe como código pero requiere `MERCADOPAGO_ACCESS_TOKEN`, que **no está
declarado en `render.yaml`** (grep completo del archivo: sólo aparece
`SENTRY_DSN` como env var de terceros con `sync: false`; ni
`MERCADOPAGO_ACCESS_TOKEN`, ni `GOOGLE_CLIENT_ID`, ni `VAPID_PUBLIC_KEY`, ni
`RESEND_API_KEY` figuran ahí).

**Por qué importa:** el modelo de negocio declarado (SaaS con mensualidad
escalonada al comercio, ADR-0005) **nunca cobró un peso**. No hay ningún
`preapproval` de Mercado Pago creado contra la API real — el código que lo
haría literalmente no puede ejecutarse sin la credencial, que no está
configurada. Para un inversor técnico esto es indistinguible de "no hay
revenue model probado".

### C3 — Bus factor de 1, sin evidencia de revisión de código humana

**Evidencia:** `git log --format='%an' | sort -u` sobre todo el historial
del repo devuelve exactamente dos autores: `julietaarrazate` y `Claude`. El
archivo `NOTICE` (raíz del repo) declara explícitamente: *"La autoría y
titularidad del software corresponden exclusivamente a Julieta Arrazate...
No existe coautoría, cofundador, cesión de derechos ni participación de
terceros"*. En los pull requests inspeccionados en esta misma sesión
(#150, #151), `get_review_comments`/`get_reviews` devolvió **cero** hilos de
revisión — el criterio de merge observado es "CI en verde", no aprobación
humana de otra persona con criterio técnico independiente.

**Por qué importa:** no es un juicio sobre la calidad del trabajo (que es
alta) sino sobre **riesgo de continuidad**. Si la fundadora no puede seguir
(salud, foco, lo que sea), no hay ningún segundo humano con contexto profundo
del sistema. Para una ronda de inversión, esto suele ser una condición
explícita a resolver (contratar al menos un ingeniero senior, o documentar
un plan de sucesión técnica) antes o inmediatamente después del cierre.

### C4 — Cero controles de seguridad automatizados en CI

**Evidencia:** `.github/workflows/ci.yml` completo (los tres jobs:
`backend`, `frontend`, `e2e`) corre exclusivamente tests funcionales
(`pytest`, `tsc`+`build`, Playwright). No hay job de secret scanning
(gitleaks/truffleHog), no hay dependency scanning en CI (el `pip-audit`/
`npm audit` de `docs/STATUS.md` 2026-08-02 fue una corrida manual, una vez,
no un gate recurrente), no hay SAST (CodeQL/Semgrep), y `npm run lint`/
`ruff check` **no corren en CI** (confirmado explícitamente en `CLAUDE.md`:
*"no lo asumas como gate aunque el checklist de sesión lo mencione"*). No
existe `.github/dependabot.yml` ni ningún otro workflow además de `ci.yml`.

**Por qué importa:** cualquier CVE nuevo en una dependencia, o un secreto
commiteado por error, **no se detecta hasta que alguien lo busca a mano**.
Ya pasó una vez en este mismo repo: `backend/.venv-audit/` (82MB, un
entorno virtual completo con potencial de contener rutas/artefactos
sensibles) estuvo trackeado en git desde el 13/07 hasta que la auditoría
OÍDO lo encontró por inspección manual el 04/08 — **tres semanas** sin que
ningún control automatizado lo marcara.

### C5 — Escalabilidad de un solo proceso: rate limiting, WebSockets y el scheduler no sobreviven un segundo worker

**Evidencia:** `backend/app/core/rate_limit.py` (comentario propio del
archivo): *"en memoria... escalar horizontalmente requeriría un store
compartido (Redis) y un ADR"*. `backend/app/core/ws_manager.py`: mismo
patrón, `ConnectionManager` en memoria del proceso. El scheduler de
asistencia/no-show (`shift/application/scheduler.py`) es un loop `asyncio`
dentro del mismo proceso web, no un worker separado — con 2+ instancias
correría duplicado. `docs/planning/LAUNCH_PLAN.md`: *"WS/rate-limit en
memoria... si por éxito inesperado hubiera que subir a 2+ workers, el
realtime y el rate-limit se degradan"*, calificado ahí mismo como *"barrera
dura de escala"*, no deuda menor.

**Por qué importa:** el día que la demanda real exija escalar
horizontalmente (el escenario que un inversor asume que va a pasar si el
producto funciona), tres subsistemas centrales (seguridad por rate limit,
tiempo real, y la automatización de no-show) se rompen simultáneamente sin
que haya un ADR o plan de migración a Redis todavía escrito — sólo
mencionado como pendiente.

### C6 — Sin entorno de staging: cada push a `main` es un deploy directo a producción

**Evidencia:** `render.yaml`: `autoDeploy: true` sobre el único servicio
declarado (`staffya-backend`, `region: ohio`, sin un segundo servicio de
staging). Vercel despliega preview por PR (visto en esta misma sesión, los
comentarios de `vercel[bot]`), pero el paso de PR a `main` no pasa por un
entorno persistente con datos/tráfico realista antes de tocar producción.
Los E2E de Playwright corren **100% contra API mockeada** (`page.route` en
cada spec, ver `frontend/e2e/mocks.ts`) — nunca contra un backend real, ni
siquiera en un ambiente de staging.

**Por qué importa:** no hay ningún punto entre "pasa en mi test mockeado" y
"está en producción sirviendo usuarios reales". Un bug de integración real
(contrato de API desalineado entre frontend/backend, por ejemplo) sólo se
detecta en producción.

### C7 — Backups de Neon nunca ensayados

**Evidencia:** `CLAUDE.md`, sección "Pendiente de la operadora", punto 3:
*"Ensayo de restore de Neon: confirmar que el backup/restore de Neon
funciona de verdad (no sólo que existe) antes de depender de él para
producción con usuarios reales."* Sigue listado como pendiente al momento
de este informe.

**Por qué importa:** RTO/RPO desconocidos. "Tenemos backups" sin haber
restaurado nunca uno es, en la práctica, "no sabemos si tenemos backups".

### C8 — `SEED_DEMO_DATA=true` sigue activo en la configuración declarada de producción

**Evidencia:** `render.yaml` línea con `SEED_DEMO_DATA: value: "true"`,
con el propio comentario del archivo advirtiendo: *"con la base real de
Neon, esto siembra datos demo en producción... Apagar ANTES de onboardear
comercios reales"*. `backend/scripts/startup_seed.py` (agregado en esta
sesión) ahora emite una alerta en logs cuando `ENVIRONMENT=production` y el
flag sigue en `true`, pero **no lo desactiva** — sigue siendo una decisión
pendiente de la operadora, no resuelta.

**Por qué importa:** cuentas demo con contraseña pública conocida
re-sembradas en cada arranque en frío contra la base de producción real. Es
el hallazgo crítico de seguridad #1 de la propia auditoría OÍDO interna
(`docs/audits/2026-08-oido/03_SECURITY.md`), sin resolver desde entonces.

### C9 — Sin entidad legal visible, sin auditoría de cumplimiento de datos

**Evidencia:** búsqueda de "S.A.S", "razón social", "CUIT", "persona
jurídica" en `LICENSE`, `NOTICE`, `/terminos`, `/privacidad`: cero
resultados. El producto maneja datos personales (nombre, email, teléfono,
ubicación, foto, historial laboral) de trabajadores y comercios en
Argentina sin que el repositorio muestre evidencia de una revisión legal de
cumplimiento con la Ley 25.326 de Protección de Datos Personales, ni de qué
entidad (si alguna) es la titular contractual frente a los usuarios.

**Por qué importa:** para due diligence de inversión, "quién es el titular
legal del producto y de los datos que procesa" es una pregunta estándar de
la primera ronda de preguntas — no encontrar nada en el repo no significa
que no exista (puede estar resuelto fuera del código), pero tampoco hay
manera de confirmarlo desde acá.

---

## Hallazgos de alto impacto (no bloquean, pero un CTO los marcaría)

- **Refresh token en `localStorage`, no en cookie `httpOnly`**
  (`docs/TECH_DEBT.md` S1, ya documentado como deuda consciente desde hace
  semanas): mientras no haya un XSS, el riesgo es bajo — pero si aparece
  uno, el radio de impacto es una sesión completa de 30 días legible por
  JavaScript.
- **CSP con `'unsafe-inline'`** en `script-src` (decisión consciente
  documentada, `frontend/next.config.ts`), reduce pero no elimina la
  superficie de un XSS.
- **WhatsApp Business API bloqueada** por falta de cuenta/credenciales de la
  operadora (`CLAUDE.md`, pendiente #5) — una feature de enganche de
  producto prometida en el roadmap, incompleta por una dependencia externa
  fuera del control del código.
- **`on_time_payment_rate`/`events_published` del comercio nunca se
  actualizan** (`CLAUDE.md`, deuda conocida) — dos métricas de reputación
  del lado comercio que existen en el modelo de datos pero no se calculan
  nunca, silenciosamente.
- **Sin monitoreo de negocio ni guardia (on-call)**: hay un healthcheck
  (UptimeRobot) y Sentry opcional (sin DSN configurado en `render.yaml`
  todavía, según la evidencia de C2), pero ninguna alerta sobre métricas de
  producto (turnos sin cubrir, caída de matching, errores de pago) más allá
  de "el servidor responde".

---

## Fortalezas reales (para que el informe sea creíble, no un hit piece)

- **Arquitectura hexagonal/DDD consistente y realmente respetada**, no sólo
  en el papel: capas `domain`/`application`/`infrastructure`/`api` separadas
  en los ~15 módulos del backend, puertos inyectados, sin el antipatrón
  típico de "hexagonal de nombre, todo acoplado por dentro". Verificado
  navegando varios módulos (`identity`, `shift`, `subscription`) durante
  esta sesión, no sólo citado de la documentación.
- **270 tests de backend** con SQLite en memoria, cobertura real de casos de
  negocio (ciclo de vida completo del turno, no-show, cancelaciones
  tardías, verificación de email, rate limiting) — no sólo "compila".
- **Documentación exhaustiva y activamente mantenida** (`docs/STATUS.md`
  como bitácora viva, ADRs numerados para decisiones de arquitectura,
  `TECH_DEBT.md`/`BUGS.md` como registro honesto de deuda) — un nivel de
  disciplina documental infrecuente en una etapa tan temprana.
- **Ciclo de hardening de seguridad reciente y bien ejecutado** (esta misma
  serie de PRs): rate limiting extendido, logging de eventos de seguridad,
  verificación de email, docs de API cerrados en producción — todo con
  tests nuevos y sin romper nada de lo existente (verificado con la suite
  completa antes/después de cada cambio).
- **Honestidad interna real**: el propio repo se autocalifica sin
  maquillaje (`LAUNCH_PLAN.md` puntúa Escalabilidad 55/100, Producto Admin
  62/100) y documenta sus propios incidentes con post-mortems
  (`docs/INCIDENTE_2026-07-23_BACKEND_CAIDO.md`). Es un patrón de
  ingeniería madura, no de ocultar problemas.

---

## Plan de remediación priorizado

| # | Acción | Quién | Esfuerzo | Bloquea |
|---|---|---|---|---|
| 1 | Onboardear los primeros comercios/trabajadores reales de la beta Palermo (`LAUNCH_PLAN.md` ya tiene el plan escrito) | Julieta (operación) | días-semanas | **C1** — sin esto, no hay nada que medir |
| 2 | Decidir y ejecutar el momento de activar `subscriptions_enforced=true` + configurar `MERCADOPAGO_ACCESS_TOKEN` real, una vez validado el funnel | Julieta (negocio) | horas de config + decisión de producto | **C2** |
| 3 | Restaurar un backup de Neon en un ambiente de prueba y documentar el RTO/RPO real | Julieta u operación técnica | 1 día | **C7** |
| 4 | Apagar `SEED_DEMO_DATA` antes del paso 1 (ya hay runbook escrito en `docs/reference/DEPLOY.md`) | Julieta | minutos | **C8** |
| 5 | Agregar `pip-audit`/`npm audit` como gate de CI (no sólo corrida manual) + Dependabot | Sesión de ingeniería | 1-2 días | **C4** |
| 6 | Sumar al menos un ingeniero senior con contexto profundo del código, o documentar un plan de continuidad técnica explícito | Julieta (decisión de equipo) | semanas | **C3** |
| 7 | Levantar un entorno de staging con backend real (no mockeado) antes de mergear a `main`, o al menos correr los E2E contra un backend real en CI | Sesión de ingeniería | 3-5 días | **C6** |
| 8 | Diseñar la migración a Redis para rate limiting/WS/scheduler (ADR ya anticipado, falta escribirlo) — ejecutar cuando aparezca la primera señal real de carga, no antes | Sesión de ingeniería | 1 ADR + 3-5 días de implementación cuando corresponda | **C5** |
| 9 | Confirmar con un abogado la entidad legal titular y una revisión de cumplimiento de Ley 25.326 | Julieta (legal) | fuera del código | **C9** |

## Conclusión para due diligence

Si la pregunta es *"¿el código está listo para escalar a producción real?"*
— sustancialmente sí, con las salvedades de C5/C6/C7 arriba, todas
resolubles en días, no meses. Si la pregunta es *"¿hay algo que invertir
todavía?"* en el sentido de tracción, revenue o validación de mercado — la
respuesta honesta es que **el repositorio no contiene esa evidencia porque
todavía no existe**. Eso no es un defecto del código: es el estado normal de
un producto que terminó de construirse y todavía no salió a la calle. La
recomendación es la misma que ya está escrita en `LAUNCH_PLAN.md` desde
hace un mes: los próximos pasos son operativos (conseguir los primeros
usuarios reales), no de ingeniería.
