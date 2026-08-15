# Auditoría delta: superficie sin auditar — 2026-08-15

> Corrida con `generators/due-diligence.md` (EKP) en modo **delta**: no
> reaudita el repo entero. Alcance = los 20 PRs mergeados **después** de la
> auditoría del 2026-08-13 (`docs/audits/2026-08-oido/`), que ninguna
> auditoría previa cubrió. Motivo de acotar: dos auditorías completas ya
> existen (2026-08-04 `DUE_DILIGENCE_REPORT.md`, 2026-08-13 las 13 fases) y
> convergen en el mismo veredicto; una tercera desde cero caería en el modo
> de falla que el propio generador nombra (*self-satisfied re-audit*).

## 1. Resumen ejecutivo

La superficie nueva (asistente de IA, guardar turnos, cuentas de prueba,
panel operacional) está **bien construida en arquitectura y seguridad, y
mal instrumentada en dinero y métricas**. Los módulos nuevos respetan la
disciplina del repo — puertos entre módulos, autorización derivada de la
sesión, salida del modelo forzada por schema y revalidada contra allowlist —
y los 4 endpoints que le cuestan plata a Julieta tienen rate limit, algo
que la mayoría de los proyectos en esta etapa no tiene.

El problema está concentrado en un solo lugar y tiene una sola causa raíz:
**el panel de métricas del negocio, construido el 2026-08-15, reporta tres
números que no significan lo que dice su etiqueta.** El más grave: la
tarjeta "Ingreso mensual recurrente" muestra pesos que nunca se cobraron,
porque el cobro real está desactivado por defecto (`mercadopago_access_token`
vacío ⇒ `subscribe()` asigna el plan sin cobrar). Es el número exacto que
la auditoría del 2026-08-04 identificó como *el único que falta validar*
(C1: "cero validación con usuarios y dinero reales"), mostrado como si ya
existiera.

**Veredicto:** la superficie nueva no bloquea la beta, pero el panel de
admin **no es confiable para decidir nada de negocio** hasta corregir F1–F3.

**Los 3 movimientos, en orden — los 3 resueltos el mismo día:**
1. ~~Arreglar las 3 métricas mentirosas del panel (F1, F2, F3)~~ — resuelto.
2. ~~Acotar el texto de entrada de los 2 endpoints de IA sin tope y poner
   `maxOutputTokens` (F4)~~ — resuelto.
3. ~~Sumar `lint` al CI y corregir el único error real que hoy nadie ve (F5)~~ — resuelto.

## 2. Contexto y vara

| Ítem | Valor |
|---|---|
| Etapa declarada | Pre-beta / beta cerrada — **sin usuarios reales ni dinero real** (`DUE_DILIGENCE_REPORT.md` C1, `LAUNCH_PLAN.md`) |
| Decisión que sostiene | "Que el producto cumpla con toda norma antes de salir y sea mejorado en cada área" (operadora, 2026-08-15) |
| Audiencia | La dueña |
| Set crítico de etapa | Seguridad · integridad de datos · operaciones · **cost & unit economics** y **data & analytics** (elevadas al set crítico: el pedido explícito fue un panel para decidir sobre el negocio) |
| Evidencia runtime | **No disponible** — los conectores de Neon/Sentry no están activos en esta sesión. Performance, operaciones y costo real quedan `provisional` (regla del generador §3.5) |
| Auditorías previas | 2 (2026-08-04, 2026-08-13). Este informe reporta deltas contra ellas, no las repite |

## 3. Mapa de lo nuevo (20 PRs, 2026-08-13 → 2026-08-15)

- **Asistente de IA** (#233, #237, #242): 3 llamadas a Gemini —
  `interpret_assistant_query` (comercio), `interpret_worker_shift_query`
  (trabajador), más las preexistentes `parse_shift_text` y
  `suggest_ticket_reply`. La IA **sólo interpreta intención**, nunca ejecuta
  ni publica (regla explícita en `core/gemini.py`).
- **Guardar turnos + comparador + ganancias** (#243, #244): módulo
  `saved_shift` nuevo.
- **Cuentas de prueba multi-rol** (#245): 2 usuarios sintéticos
  (`prueba.*@oido.beta`) accesibles sólo por impersonación de admin.
- **Panel operacional** (#246, #247): 6 tasas de producto ya calculadas
  expuestas + métricas nuevas de suscripción (MRR, distribución, cerca del
  límite).
- **Diseño y observabilidad** (#215, #216, #232, #234-#236): eventos de
  negocio, gate de CI de dependencias/secretos, tintas Espresso/Petróleo.

## 4. Perfil de madurez (sólo dimensiones tocadas por la superficie nueva)

| Dimensión | Banda | Evidencia | Qué pide la banda siguiente |
|---|---|---|---|
| Arquitectura | **3** Profesional | `assistant/application/services.py:1-10` compone por puerto (`ShiftRepository`), nunca por servicio ajeno; `saved_shift/api/routes.py:63-107` deriva el dueño de la sesión | Nada urgente en esta superficie |
| Seguridad | **3** Profesional | Prompt: instrucción de sistema con valores confiables, texto del usuario en `contents` separado, salida forzada por `responseSchema` y **revalidada** (`gemini.py:206`); `saved_shift` sin IDOR (repo filtra por `worker_profile_id`) | Logging de eventos de seguridad (H2, sigue abierto de la auditoría del 13/08) |
| Testing | **3** Profesional | Suites ejecutadas por esta auditoría, no leídas: backend `pytest` **404 passed**; frontend `test:unit` **74 passed**; Playwright **76 passed** (corrida previa de hoy) | Cobertura E2E del asistente contra un backend real, no sólo mocks |
| CI/CD | **3** Profesional | Pipeline **ejecutado localmente paso por paso** (`tsc` limpio, `test:unit` 74/74, `pytest` 404): `.github/workflows/ci.yml` corre pytest + tsc + test:unit + build + Playwright, con gating por path | Sumar `npm run lint` (F5) — es el único gate que no corre |
| Documentación | **2** Funcional | `docs/STATUS.md` estuvo 9 PRs desactualizado hasta hoy; el roadmap del 13/08 quedó obsoleto en 2 días (Q9, Q10, H3 ya hechos, sigue listado como pendiente) | Un mecanismo que lo fuerce, no una convención escrita (ver F6) |
| Cost & unit economics | **1** Ad hoc | Sin `maxOutputTokens` en ninguna de las 4 llamadas (`gemini.py`); 2 de 3 endpoints sin tope de largo de entrada; sin alerta de gasto sobre la API key | F4 + un tope de gasto en la consola de Google |
| Data & analytics | **1** Ad hoc | 3 de las métricas del panel nuevo no significan lo que dice su etiqueta (F1, F2, F3) | F1-F3 corregidas + un test por métrica que fije su definición |

Dimensiones no re-evaluadas (sin cambios materiales en el delta):
performance, UX, infraestructura, escalabilidad, mantenibilidad, deuda
técnica, producto, operaciones. Ver las auditorías del 04/08 y 13/08.

## 5. Veredicto de aptitud

**Compuesto con gate, no promedio.** El mínimo sobre el set crítico de
etapa manda:

- Seguridad 3 · Operaciones (no re-evaluada, 13/08) · Integridad de datos 3
- **Cost & unit economics 1** ← bloqueante
- **Data & analytics 1** ← bloqueante

**Veredicto: `conditionally ready` (aptitud condicionada), bloqueantes
nombrados.** No bloquea *lanzar la beta* — bloquea **usar el panel de admin
para decidir sobre el negocio**, que es exactamente para lo que se pidió.
Los bloqueantes son F1-F4, todos E1 (horas, no días).

## 6. Fortalezas (preservar)

1. **La IA no actúa, sólo interpreta.** Regla escrita y sostenida en las 4
   llamadas: la salida se fuerza por `responseSchema` y además se
   revalida contra una allowlist (`gemini.py:206` descarta un `position`
   que no esté en `_POSITIONS`). Es defensa en profundidad real, no un
   comentario.
2. **Rate limit en todo lo que cuesta plata.** Los 4 endpoints que llaman a
   Gemini tienen `RateLimiter` con clave por comercio/usuario, no por IP.
3. **Autorización derivada de la sesión, nunca del request.** `saved_shift`
   toma el `worker_profile_id` de la dependencia autenticada; el repo
   filtra por dueño en cada query.
4. **El ejecutor corrige al orquestador.** Patrón ya registrado en EKP
   (intake ciclo 32) y visible de nuevo acá.

## 7. Hallazgos

**Causa raíz común a F1, F2 y F3** (los tres shipeados el mismo día, en el
mismo panel): *las métricas se derivaron leyendo contadores guardados sin
reproducir las reglas de dominio que les dan sentido.* No son tres bugs
sueltos: es una capa de métricas construida sin un paso de "¿este número
significa lo que dice la etiqueta?".

### F1 — "Ingreso mensual recurrente" muestra plata que nunca se cobró · S1 · E1 · ✅ Resuelto (2026-08-15, mismo día)
**Evidencia:** `config.py:87` `mercadopago_access_token: str = ""` (vacío por
defecto) ⇒ `subscription/application/services.py:57` `self._billing.enabled`
es False ⇒ rama `else`: `subscription.change_plan(plan.code)` asigna el plan
**sin cobro** y devuelve `checkout_url=None`. `admin/application/services.py`
`get_subscription_stats()` suma `price_ars` de toda suscripción `ACTIVA`, y
`frontend/app/admin/page.tsx` la rotula "Ingreso mensual recurrente / ARS …".
**Escenario de falla:** 3 comercios prueban el plan Pro en la beta. No se les
cobra un peso. El panel muestra "ARS 135.000" de ingreso recurrente. Julieta
lo lee como facturación — para decidir si el negocio funciona, o para
mostrárselo a un inversor. La auditoría del 04/08 dice que lo único que
falta validar es exactamente eso ("con dinero y usuarios reales"): el panel
lo muestra como si ya hubiera pasado.
**Arreglo:** mientras `billing.enabled` sea False, rotular sin ambigüedad
("MRR potencial — cobro no activado") o mostrar 0 con el estado explícito.

### F2 — Las cuentas sintéticas inflan las métricas del propio panel · S2 · E1 · ✅ Resuelto (2026-08-15, mismo día)
**Evidencia:** `identity/infrastructure/repositories.py:104` `count_stats()`
cuenta **todas** las filas de `users`, sin exclusión. Existen 4 usuarios
sintéticos: 2 invitados (`invitado.*@oido.beta`) y 2 de prueba
(`prueba.*@oido.beta`, creados por mí en #245 con `is_verified=True`).
Peor: los de prueba se crean **lazy** en `GET /admin/test-accounts`, que el
panel llama en **cada carga** — abrir el panel por primera vez sube
`total_users` en 2 y esa misma pantalla muestra el número inflado.
**Escenario de falla:** beta cerrada con 10 comercios reales. El panel dice
14 usuarios, 40% de error, y "Verificados" cuenta 2 cuentas que nadie
verificó. Toda tasa con usuarios en el denominador queda sesgada.
**Arreglo:** excluir el conjunto de emails sintéticos en `count_stats()`
(ya existe `GUEST_ACCOUNT_EMAILS` como precedente del patrón).

### F3 — "Cerca del límite" cuenta comercios cuyo período ya venció · S2 · E1 · ✅ Resuelto (2026-08-15, mismo día)
**Evidencia:** `subscription/domain/entities.py:41` `roll_period_if_expired()`
se invoca desde **un solo lugar**: `shift/application/services.py:347`, o sea
sólo al publicar un turno. Ningún camino de lectura lo llama. Mi
`count_at_plan_limit()` (#247) hace un `COUNT` puro de
`turnos_usados_mes >= limite`, sin mirar `period_end`.
**Escenario de falla:** un comercio del plan gratis publica sus 3 turnos en
agosto y no vuelve a publicar. En octubre el panel lo sigue contando como
"cerca del límite", aunque su período venció hace un mes y se resetearía
solo en su próxima publicación. Julieta lo llama para venderle un upgrade
que no necesita.
**Arreglo:** sumar `period_end > now` a la condición del query.

### F4 — Texto sin tope hacia endpoints que se pagan por token · S2 · E1 · ✅ Resuelto (2026-08-15, mismo día — la parte operativa, tope de gasto en Google Cloud, sigue en manos de la operadora)
**Evidencia:** `assistant/api/schemas.py:13` y `:59` declaran `text: str`
**sin `max_length`**, mientras el endpoint hermano y más viejo
`shift/api/schemas.py:175` sí lo acota (`Field(min_length=3, max_length=500)`).
Ninguna de las 4 llamadas de `core/gemini.py` setea `maxOutputTokens`. El
rate limit acota la **cantidad** de requests (15/10min), no el **tamaño** de
cada uno.
**Amplificadores:** el acceso de invitado usa un PIN fijo de 4 dígitos
hardcodeado (`identity/application/services.py:74`, y repetido en
`e2e/guest-onboarding.spec.ts`) — quien lo tenga tiene sesión de trabajador
permanente, no rotable sin deploy; y `RateLimiter` guarda el estado **en
memoria del proceso** (`core/rate_limit.py:30`), así que con más de una
instancia el tope efectivo se multiplica y se reinicia en cada deploy.
**Escenario de falla:** 15 requests de ~1 MB cada uno por ventana de 10
minutos contra la API key de Julieta. Gemini cobra por token de entrada: el
tope de requests no acota el gasto.
**Arreglo:** `max_length=500` en los 2 schemas (misma vara que el hermano) +
`maxOutputTokens` en `_call_gemini` + tope de gasto en la consola de Google.

### F5 — `lint` es el único gate que no corre en CI, y ya hay 1 error real · S3 · E1 · ✅ Resuelto (2026-08-15, mismo día)
**Evidencia:** `.github/workflows/ci.yml` corre pytest, tsc, `test:unit`,
build y Playwright — **no** `npm run lint`. Corriéndolo hoy:
`lib/use-voice-dictation.ts:43` → `error Cannot access refs during render`
(`react-hooks/refs`): se escribe `onTranscriptRef.current` durante el render.
`docs/STATUS.md` (2026-08-05) afirma "`npm run lint` en 0 errores".
**Escenario de falla:** el patrón "latest ref" escrito en render es
oficialmente inseguro con render concurrente/StrictMode: un render
descartado puede dejar la ref apuntando a un callback que no corresponde al
commit final, y el dictado por voz llamaría al handler equivocado. Impacto
práctico hoy: bajo. Impacto del proceso: cualquier error futuro de esta
clase tampoco se va a ver.
**Arreglo:** mover la asignación a un `useEffect` + sumar el step al CI.

### F6 — La documentación envejece más rápido de lo que se la mantiene · S3 · E2
**Evidencia:** el roadmap del 13/08 lista Q9 (`/admin/stats` en SQL), Q10
(rate limit en `/auth/refresh`) y H3 (`/verify-email`) como pendientes: los
tres **ya están implementados** (`count_stats`, `_refresh_rate_limit`,
ruta `/verify-email`). De 4 ítems verificados al azar, 3 estaban obsoletos a
los 2 días. `docs/STATUS.md` estuvo 9 PRs atrasado hasta hoy.
**Escenario de falla:** la próxima sesión (humana o IA) planifica contra un
roadmap obsoleto y reimplementa lo hecho, o peor, confía en que algo está
pendiente cuando ya se resolvió. La auditoría del 13/08 ya lo nombró como
hallazgo transversal ("el código sigue adelante de la documentación") y
volvió a pasar igual.
**Arreglo:** no más convenciones escritas — un gate. Ver ruteo §9.

## 8. Hoja de ruta

**Desbloquear (hoy, ~3h)** — devuelve confiabilidad al panel:
| # | Acción | Sube la banda de |
|---|---|---|
| 1 | F1 rotular/gatear el MRR según `billing.enabled` | Data & analytics 1→2 |
| 2 | F2 excluir cuentas sintéticas de `count_stats` | Data & analytics 2→3 |
| 3 | F3 sumar `period_end > now` al conteo de límite | Data & analytics (consolida 3) |

**Estabilizar (esta semana, ~2h):**
| # | Acción | Sube la banda de |
|---|---|---|
| 4 | F4 `max_length` + `maxOutputTokens` + tope de gasto | Cost & unit economics 1→3 |
| 5 | F5 `lint` al CI + arreglar `use-voice-dictation.ts:43` | CI/CD 3→3 (consolida), Mantenibilidad |

**Profesionalizar (cuando haya señal):**
| # | Acción | Sube la banda de |
|---|---|---|
| 6 | Un test por métrica que fije su definición de negocio | Data & analytics 3→4 |
| 7 | H2 (heredado del 13/08): logging de eventos de seguridad | Seguridad 3→4 |
| 8 | F6: gate de documentación (ver §9) | Documentación 2→3 |

## 9. Ruteo de hallazgos a artefactos

| Hallazgo | Ruta | Estado |
|---|---|---|
| F1, F2, F3 | Corrección directa (E1, misma superficie que las introdujo) | Pendiente — requiere OK de la operadora sobre el rótulo del MRR |
| F4 | Corrección directa + acción operativa (tope de gasto en Google Cloud) | La parte operativa es de Julieta |
| F5 | Corrección directa + 1 step en `ci.yml` | Pendiente |
| F6 | **Lección sobre EKP mismo** → `evolution/INTAKE.md` | Es la misma clase de fricción que BDR-009 acaba de atacar del lado de las sesiones; acá reaparece del lado de los roadmaps de auditoría. Se archiva como intake, no como fix local |
| Definición de métricas | Propuesta de ítem de checklist para el dominio backend/producto de EKP: *"una métrica de negocio no se da por hecha hasta que un test fija qué significa su etiqueta"* | Intake |

---

*Corrida por una sesión T1 (Opus) operando EKP sobre `staffing-gastro`,
según `generators/due-diligence.md` v1.0.0 y el modelo de bandas de
`engines/review-engine.md` v1.1.0. Las bandas de CI/CD y testing se
acreditaron **ejecutando** los pipelines, no leyendo su configuración
(gate de calidad §7 del generador). Tres de los seis hallazgos (F1, F2, F3)
son sobre código que esta misma sesión escribió horas antes.*
