# INVESTMENT_BINDER.md — Carpeta de inversión de Staffya

> Auditoría técnica, valuación, modelo financiero y propuesta de ronda,
> construidos sobre evidencia verificable del repositorio (código, tests,
> ADRs, `docs/`) — no sobre métricas, clientes ni ingresos inventados.
> Fecha de la auditoría: **2026-08-26**. Como el resto de `docs/`, este
> archivo puede quedar desactualizado si pasa mucho tiempo — reverificar
> contra el código antes de citar un número en una reunión real.
>
> **Este documento es la versión para compartir.** La estrategia de
> negociación (ancla/objetivo/punto de retiro, matriz de concesiones, guion
> de preguntas difíciles) es intencionalmente **un documento aparte, fuera
> de este repositorio** — nunca se sube a `docs/` porque revela el margen de
> maniobra de la fundadora frente a la contraparte.

## Cómo leer las etiquetas de evidencia

Cada cifra de este documento está marcada con una de estas cinco etiquetas,
para no confundir un hecho verificado con una hipótesis:

- **[A] Comprobado** — verificado directamente en el código o los docs del repo.
- **[B] Supuesto** — premisa explícita, declarada, no verificada.
- **[C] Estimación** — cálculo con metodología declarada.
- **[D] Proyección** — escenario futuro, no un hecho.
- **[E] A validar** — requiere confirmación externa (legal, contable, de mercado).
- **DATO FALTANTE** — no existe evidencia en el repo. No se inventó un número para llenar el hueco.

---

## 0 · Resumen ejecutivo

**Staffya ("Oído")** es un marketplace de staffing gastronómico en tiempo
real para Argentina/LATAM: conecta comercios gastronómicos (bares,
restaurantes, eventos) con trabajadores eventuales (mozos, bartenders,
baristas, cocineros) para cubrir turnos puntuales. Misión declarada:
*cubrir una posición eventual en menos de 10 minutos*. Patrón de producto:
Uber (oportunidades cerca, en tiempo real) + Tinder (swipe para
postularse) + WhatsApp (chat por turno) + reputación bidireccional. **[A]**

El producto **existe y funciona**: 94 endpoints de API sobre 17 módulos con
arquitectura hexagonal/DDD, 30 pantallas de frontend (PWA instalable), 423
tests de backend y 79 de frontend en verde, CI obligatorio, deploy
automático en Render+Vercel+Neon, 30 migraciones de base de datos, 11 ADRs
de arquitectura documentados y ~70 documentos técnicos activamente
mantenidos. **[A]** — evidencia completa en la sección 1 y 2.

Lo que **todavía no existe** es igual de real: la beta cerrada en Palermo
(CABA) arrancó el 15/08/2026, la monetización está construida pero
**apagada por decisión de producto** (`subscriptions_enforced=false`, sin
credenciales de Mercado Pago cargadas), y no hay un solo peso de ingreso
registrado. No hay founding team más allá de la fundadora (bus factor 1). **[A]**

> **La tensión central de esta ronda:** el código es más maduro que el
> negocio. Un inversor técnico que audite el repo va a encontrar disciplina
> de ingeniería fuera de lo común para la etapa (ver `DUE_DILIGENCE_REPORT.md`,
> ya escrito en la raíz del repo). Pero ningún dato de tracción, retención o
> disposición a pagar existe todavía porque el producto recién salió a la
> calle. Esta carpeta no maquilla esa brecha: la cuantifica.

### Recomendación en una página

| | |
|---|---|
| **Capital a levantar** | USD 110.000–120.000 (ronda recomendada, 18 meses de runway) **[D]** |
| **Valuación pre-money** | USD 380.000 (caso base) — rango defendible USD 180.000–650.000 **[C]** |
| **Valuación post-money** | ≈ USD 495.000 **[C]** |
| **Equity a ofrecer** | ≈ 22–23% en la ronda recomendada — resultado de la cuenta, no un punto de partida (sección 8) |
| **Founder salary** | USD 2.000/mes (mercado técnico senior AR: USD 2.500–4.000) **[C]** |
| **Estructura preferida** | Equity directo (SA/SAS) con desembolso en tramos por milestone — no SAFE puro, no préstamo |
| **Control operativo** | Founder conserva mayoría de directorio y veto sobre producto/roadmap/IP; inversor gana information rights + reserved matters sobre finanzas y nuevas rondas |

Desarrollo completo de cada número, con fórmula y supuestos, en las
secciones 3, 6, 7 y 8.

---

## 1 · Auditoría del producto

"Hay código" no es lo mismo que "hay producto terminado". Evidencia de
archivo/línea/documento tomada del repo real el 26/08/2026.

| Componente | Estado | Evidencia | Riesgo | Trabajo restante | Impacto en valoración |
|---|---|---|---|---|---|
| Arquitectura backend | Maduro | Hexagonal/DDD real en 17 módulos, puertos inyectados. Verificado navegando `identity`, `shift`, `subscription` — `DUE_DILIGENCE_REPORT.md` | Bajo | Migrar rate-limit/WS/scheduler de memoria a Redis cuando haya señal real de carga | Sube costo de reposición, baja riesgo técnico de due diligence |
| API / endpoints | Completo p/ MVP | 94 endpoints REST, paginación consistente, no-disclosure (404 en vez de 403) | Bajo | Ninguno bloqueante | Neutro-positivo |
| Frontend / PWA | Maduro | 30 pantallas, 86 componentes, PWA instalable, responsive auditado pantalla por pantalla (cerrado 2026-08-05), Design System con tokens WCAG AA | Bajo | 7 usos de `<img>` sin `next/image` (prioridad baja) | Activo fuerte para la etapa |
| Base de datos | En producción | Postgres serverless en Neon, 30 migraciones Alembic, región co-ubicada con backend tras incidente real documentado | Medio | Restore de backup nunca ensayado — RTO/RPO desconocidos | Riesgo operativo real, barato de cerrar (1 día) |
| Autenticación / sesiones | Endurecido | JWT + refresh rotativo, tabla `refresh_sessions`, detección de reuso, refresh token en cookie httpOnly (no `localStorage`) desde 08/08/2026 | Medio | Depende de `ENVIRONMENT=production` en Render para `Secure`+`SameSite=None` — verificar | Punto a favor ya resuelto |
| Seguridad perimetral | Parcial | Rate limiting real, security headers (HSTS, CSP, X-Frame-Options), límites de WebSocket por usuario | Medio | Starlette con CVEs conocidos, upgrade mayor diferido a propósito | Cerrable en 1-2 días |
| Monetización / pagos | Construido, apagado | Modelo decidido (ADR-0005: mensualidad escalonada). Entidad `Subscription`, `MercadoPagoSuscripcionAdapter` existen en código. `subscriptions_enforced=false`, sin credenciales de MP | **Alto (de negocio)** | Definir montos, cargar credenciales, activar el flag — decisión de negocio, no de ingeniería | **El hallazgo más importante**: nunca se cobró un peso |
| Matching / reputación | Real, no cosmético | Reputación derivada del ciclo real del turno entra al scoring de matching, verificado end-to-end (#88) | Bajo | Afinidad histórica local↔trabajador: fase futura | Diferenciador real, defendible ante due diligence |
| No-show / asistencia | Automatizado | Detección automática por scheduler en proceso (ADR-0008), escalada de urgencia (ADR-0009) | Bajo | Ninguno bloqueante | Resuelve un problema real de producto |
| Testing | Fuerte para la etapa | 423 tests backend, 79 unitarios frontend, 30 specs E2E, CI obligatorio en cada PR | Medio | E2E 100% contra API mockeada, sin staging | Disciplina infrecuente en pre-seed |
| CI/CD | Parcial | `.github/workflows/ci.yml` con detección de cambios por área, 3+ jobs obligatorios (pytest, tsc+build, Playwright), más gates de seguridad (secret scanning, dependency audit) | Medio | Sin entorno de staging: cada push a `main` es deploy directo a producción | Riesgo operativo estándar de la etapa |
| Observabilidad | Parcial | Sentry en código (activado 2026-08-15), logging estructurado JSON con `request_id`, healthcheck | Medio | Sin alertas de métricas de negocio más allá de "el servidor responde" | Suficiente para beta chica |
| Escalabilidad | Barrera dura, no urgente | Rate limiting/WS/scheduler en memoria de un solo proceso, documentado explícitamente en el propio código | Medio (condicional) | ADR de migración a Redis anticipado, no escrito. Se activa con demanda real de 2+ workers | No penaliza hoy; pregunta esperable de due diligence |
| Continuidad técnica | Bus factor 1 | 118 commits totales, 97 de la fundadora (mayoría con `Co-authored-by: Claude`), 21 de sesiones autónomas. Cero hilos de revisión humana de un segundo ingeniero | **Alto** | Sumar ingeniero senior o documentar plan de continuidad | Riesgo real y con nombre — no se resuelve sin la ronda |
| Propiedad intelectual | Resuelto | Licencia propietaria "All Rights Reserved", `NOTICE` formaliza titularidad exclusiva, criterio de autoría IA-como-herramienta documentado. Checklist DNDA completo salvo trámite legal formal | Bajo | Registro formal ante DNDA y confirmación de entidad legal — trabajo legal, no de repo | Punto a favor infrecuente en esta etapa |
| Marco legal / entidad | Sin evidencia en repo | Búsqueda de "S.A.S"/"razón social"/"CUIT" en `LICENSE`/`NOTICE`/legales: sin resultados | **Alto** | Confirmar con abogado entidad titular y compliance Ley 25.326 | **DATO FALTANTE** — pregunta estándar de primera ronda de due diligence |
| Tracción / usuarios reales | Inicio de beta | Beta cerrada Palermo desde 15/08/2026: reclutamiento de 3-5 comercios y 20-50 trabajadores en curso | **Alto** | Es, literalmente, el trabajo que financia esta ronda | **DATO FALTANTE** — sin tiempo de cobertura medido, retención ni disposición a pagar real |
| Documentación | Excepcional para la etapa | ~70 archivos en `docs/`: fundación, 11 ADRs, sistema de diseño con WCAG medido, bitácora viva, catálogo honesto de deuda técnica | Bajo | Ninguno | Reduce el riesgo de "sólo lo entiende una persona" a nivel de conocimiento |

---

## 2 · Inventario del activo construido + costo de reposición

### Inventario cuantificado (verificado en el repo, 26/08/2026)

| Categoría | Cantidad | Detalle |
|---|---:|---|
| Módulos de dominio (backend, hexagonal/DDD) | 17 | identity, worker, company, shift, application, matching, chat, notification, review, favorite, saved_shift, subscription, verification, admin, support, upload, assistant |
| Endpoints de API REST | 94 | `grep @router.get\|post\|put\|patch\|delete` sobre `backend/app` |
| Líneas de código Python (backend) | 29.995 | `find backend -name "*.py" \| xargs wc -l` |
| Migraciones de base de datos (Alembic) | 30 | Incluye la migración de proveedor (Render→Neon) |
| Tests de backend (pytest) | 423 | SQLite en memoria, verde a la fecha |
| Pantallas de frontend (Next.js App Router) | 30 | Feed, mapa, búsqueda, wizard con IA, panel admin, chats, perfiles, suscripción, onboarding, legales |
| Componentes de frontend | 86 | Incluye Design System propio |
| Líneas de código TypeScript/TSX (frontend) | 26.511 | `find frontend -name "*.ts*" \| xargs wc -l` |
| Tests unitarios de frontend (Vitest) | 79 | Zona horaria AR, tabla de estados, Haversine/tiempos de viaje |
| Specs E2E (Playwright) | 30 archivos | 73 casos `test()` verificados por grep, API mockeada |
| ADRs (decisiones de arquitectura) | 11 | MapLibre, sesiones revocables, asignación única, cancelación/insignias, pagos, alta de local, no-show, escalada, confianza, segunda tinta |
| Documentos técnicos/producto (`docs/`) | ~70 | Fundación, diseño, referencia, planning, auditorías |
| Integraciones de terceros con flag propio | 8 | Cloudinary, Google Identity, Web Push/VAPID, Resend, Gemini, Mercado Pago (apagado), Sentry, Nominatim/OSM |
| Commits en el repositorio | 118 | 97 de la fundadora (mayoría co-autorados con asistencia IA, documentado), 21 de sesiones autónomas |

### Metodología del costo de reposición

Estimación *bottom-up* por disciplina, no un multiplicador arbitrario de
líneas de código. Horas por complejidad de módulo/pantalla, contrastadas
contra el total de LOC como control de sanidad (56.506 LOC totales ÷ 4.550h
≈ 12,4 LOC/hora — consistente con código productivo, testeado y
documentado; el rango de industria para ese nivel de calidad ronda
10–20 LOC/hora). **[C]**

| Disciplina | Horas | Base del cálculo |
|---|---:|---|
| Backend (dominio, casos de uso, API, infra, tests, migraciones) | 2.400 | 4 módulos grandes ×200h + 6 medianos ×120h + 7 chicos ×60h + infra transversal 300h |
| Frontend (pantallas + Design System + PWA) | 1.200 | 5 pantallas grandes ×90h + 15 medianas ×40h + 10 chicas ×20h + DS compartido 500h |
| UX/UI (sistema de diseño, dirección de arte, WCAG) | 150 | Paleta con contraste medido, tipografía, iconografía, tokens |
| QA (arquitectura de tests, CI, mocks E2E) | 200 | Fixtures, mocking de API, wiring de CI multi-job |
| DevOps (infra, CI/CD, runbooks, incidentes) | 150 | Render+Vercel+Neon, Docker, tuning de región, runbooks |
| Arquitectura (ADRs, límites de módulo) | 150 | 11 ADRs con contexto/decisión/consecuencias |
| Documentación técnica y de producto | 150 | ~70 documentos activamente mantenidos |
| Project management / auditoría continua | 150 | Bitácora viva, catálogo de deuda técnica priorizado |
| **Total** | **4.550 h** | ≈ 2,2 años-persona a 40h/semana en un solo recurso equivalente |

### Tres escenarios de tarifa (nearshore/LATAM) **[E — validar contra cotizaciones reales]**

| Escenario | Tarifa/hora | Costo total |
|---|---:|---:|
| Conservador | USD 35 | USD 159.250 |
| **Base** | USD 55 | **USD 250.250** |
| Alto | USD 85 | USD 386.750 |

> **Costo de reposición ≠ valoración de equity.** Esto es lo que costaría
> reconstruir el software — un piso de referencia, no lo que vale la
> empresa. Una empresa vale por su capacidad futura de generar caja
> (ingresos, retención, defensibilidad, mercado), y hoy Staffya tiene
> ingreso cero. La sección 3 desarrolla los métodos que sí corresponden a
> valuación de equity.

---

## 3 · Valoración del negocio

### 1 · Cost approach / Replacement cost

- **Fórmula:** horas por disciplina × tarifa/hora blended.
- **Resultado:** USD 159.250 / 250.250 / 386.750 (sección 2).
- **Límites:** no captura mercado, tracción ni riesgo de ejecución. Sirve como piso, no como valuación.

### 2 · Venture Capital Method

- **Fórmula:** Post-money = Valor de salida proyectado ÷ Múltiplo de retorno exigido. Pre-money = Post-money − Inversión.
- **Inputs [D]:** salida hipotética a 6-7 años, ARR USD 2,5M–4M (extrapolado más allá de los 36 meses modelados) × múltiplo SaaS/marketplace 4–6x ARR = USD 10M–24M. Múltiplo de retorno pre-seed: 15–30x.
- **Resultado:** Post-money implícito ≈ USD 500.000–1.200.000 (punto medio 20x) → Pre-money implícito ≈ USD 385.000–1.085.000 (con inversión de USD 115.000).
- **Límites:** extremadamente sensible a supuestos de industria, no a datos de Staffya. Banda de contraste, no ancla principal.

### 3 · Comparables (múltiplos)

- **Inputs [E]:** USD 540M levantados en rondas seed/ángel en toda LATAM durante 2025 ([Crunchbase News, oct 2025](https://news.crunchbase.com/venture/vcs-bullish-latam-startup-funding-rebounds-2025/)); comparables de categoría en etapa madura: Instawork levantó USD 160M en 6 rondas, Wonolo USD 195M en 9 rondas (última Serie D de USD 140M en 2021, [TechCrunch](https://techcrunch.com/2021/10/19/wonolo-raises-140m-for-its-staffing-platform-used-by-1m-laborers-and-front-line-workers/)). No se encontró una ronda pre-seed/seed pública de staffing gastronómico en Argentina/LATAM — **DATO FALTANTE**, no se fuerza un comparable directo.
- **Resultado:** sin comparable directo citable. El rango pre-seed pre-revenue típico en LATAM con producto funcionando suele ubicarse en el orden de USD 200.000–800.000 pre-money — conocimiento general de mercado, no una cifra con fuente puntual. **[E — reemplazar por datos de LAVCA/informes sectoriales antes de negociar con precisión]**

### 4 · DCF — no aplicado, no forzado

Un DCF requiere flujos de caja históricos mínimamente confiables. Staffya
no factura hace ni un mes: cualquier DCF sería una cadena de supuestos
disfrazada de precisión. Se reemplaza por el modelo de escenarios de la
sección 5.

### 5 · Scenario valuation

| Escenario | Pre-money | Base |
|---|---:|---|
| Conservadora | USD 180.000 | Costo de reposición conservador + prima mínima. Refleja bus factor 1 y cero ingresos con todo su peso |
| **Base — la que se lleva a la mesa** | **USD 380.000** | Costo de reposición base + prima por arquitectura/testing/documentación + beta ya iniciada |
| Optimista | USD 650.000 | Requiere que el inversor valore explícitamente el aporte estratégico no monetario (sección 9) |

### 6 · Strategic value

El valor del aporte no monetario de un inversor con experiencia de gestión
de PyME (sección 9) se trata como reductor de riesgo de ejecución, **nunca
sumado directamente al pre-money** — mezclar "cuánto vale la empresa" con
"cuánto vale que ustedes entren" es el error más común de este tipo de
negociación.

---

## 4 · Mercado

### Tamaño de mercado — bottom-up

| Nivel | Universo | Cómo se llega al número |
|---|---:|---|
| TAM (Argentina, gastronomía+eventos) | ~130.000–150.000 establecimientos **[C]** | Extrapolación proporcional desde CABA — **[E]** validar con censo económico/AFIP |
| SAM (CABA+GBA+grandes ciudades) | ~45.000–55.000 establecimientos **[C]** | Estimación proporcional, no censo directo |
| **SOM (CABA, mercado inicial real)** | **>13.000 locales gastronómicos [A]** | Gobierno de la Ciudad de Buenos Aires, vía [Infobae, jun 2025](https://www.infobae.com/economia/2025/06/11/restaurantes-en-crisis-por-la-fuerte-caida-del-consumo-cierran-cada-vez-mas-locales-en-caba-y-hay-alerta-en-el-sector/) — +15% de aperturas nuevas oct2023–oct2024 (~1.300 locales/año) |

**Contexto macro:** el sector gastronómico argentino atraviesa una caída de
consumo del 20–30% interanual en 2025 por costos operativos y menor
turismo receptivo ([Ámbito](https://www.ambito.com/negocios/bares-y-restaurantes-venden-30-menos-2025-y-no-logran-cubrir-sus-costos-n6171114), [0221](https://www.0221.com.ar/nacional/las-ventas-bares-y-restaurantes-se-derrumbaron-un-30-y-el-sector-redefine-estrategias-sobrevivir-n113608)).
Es viento en contra para el ticket promedio de los comercios, pero viento a
favor para Staffya: comercios bajo presión de costos tienen más incentivo
a optimizar su plantilla eventual en vez de sostener personal fijo caro.

El financiamiento seed/ángel en LATAM alcanzó USD 540M en 2025, con
gig-economy de servicios locales (incluido "event staff") señalado como la
mayor oportunidad de espacio blanco de la región ([Konvoy VC](https://www.konvoy.vc/newsletters/latams-local-gig-economy)).

### Competencia

| Cómo se resuelve hoy | Por qué no es competencia directa |
|---|---|
| WhatsApp + contactos + grupos gastronómicos | El "competidor" real y dominante hoy — es lo que Staffya reemplaza |
| Bolsas de trabajo genéricas (ZonaJobs, Computrabajo, LinkedIn) | Resuelven contratación permanente, no cobertura de un turno puntual hoy |
| Apps de staffing gig internacionales (Instawork, Wonolo) | Sin presencia en Argentina/LATAM (no encontrada en esta investigación) — validan la categoría sin competir localmente |
| Competidor directo local (Argentina, staffing gastronómico eventual con app) | **DATO FALTANTE** — no verificado desde esta investigación; primera pregunta a validar por el inversor |

### Barreras de entrada / diferenciadores reales

- Reputación bidireccional con datos reales del ciclo del turno — efecto de red genuino, no cosmético.
- Densidad geográfica como ventaja de arranque (estrategia Palermo): en un marketplace de dos lados, la liquidez local importa más que la cobertura nacional temprana.
- Calidad de ejecución técnica como barrera blanda: la disciplina de arquitectura/testing/producto no se copia de un día para otro.
- Lo que **no** es una barrera todavía: sin contratos de exclusividad, sin patente, sin efecto de red probado con datos reales (todavía no hay usuarios suficientes).

---

## 5 · Modelo financiero (36 meses) — proyección explícitamente hipotética

Staffya no factura hoy. Todo lo que sigue son escenarios sobre hipótesis
declaradas (pricing, adopción, churn), no extrapolación de datos
históricos. Moneda: USD como unidad de cuenta estable — la operación real
se presupuesta y factura en ARS.

### Supuestos explícitos

| Supuesto | Valor | Tipo |
|---|---|---|
| Pricing (ADR-0005 fija el modelo, no los montos — "se calibran en la beta") | Gratis (≤5 turnos/mes) · Básico USD 15/mes · Pro USD 40/mes | **[B]** |
| Comercios activos M1-M3 (beta Palermo) | 5 comercios, 100% plan gratis | **[A]** — coincide con el estado real |
| Activación de cobro | Mes 4 | **[D]** |
| Curva de adopción (M6→M36) | 25→80→180→320→480→650 comercios activos | **[D]** — bottom-up desde SOM de 13.000+ locales, ~5% de penetración a 36 meses |
| Mix pago/gratis en régimen (M18+) | ~65-70% en plan pago | **[B]** |
| Churn logo mensual | 5%/mes | **[C]** — benchmark SaaS SMB temprano |
| ARPU blended (comercios pagos) | ≈ USD 22/mes | **[C]** |
| CAC | USD 15 (M1-12, founder-led) → USD 60 (M24-36, con marketing pago) | **[C]** |
| LTV | ≈ USD 440/comercio pago | **[C]** — derivado |
| LTV:CAC en régimen | ≈ 7-11x | **[D]** |
| Gross margin | 78% | **[C]** |

### P&L resumido — trimestral, 3 años **[D]**

| Trimestre | Comercios activos | Comercios pagos | MRR (USD) | Revenue trim. | OPEX trim. | EBITDA trim. |
|---|---:|---:|---:|---:|---:|---:|
| Q1 (M1-3) | 5 | 0 | 0 | 0 | 18.000 | -18.000 |
| Q2 (M4-6) | 25 | 10 | 220 | 440 | 19.500 | -19.060 |
| Q3 (M7-9) | 48 | 25 | 550 | 2.700 | 21.000 | -18.300 |
| Q4 (M10-12) | 80 | 45 | 990 | 4.600 | 22.500 | -17.900 |
| Q5 (M13-15) | 120 | 78 | 1.716 | 7.500 | 26.000 | -18.500 |
| Q6 (M16-18) | 180 | 120 | 2.640 | 12.900 | 28.500 | -15.600 |
| Q7 (M19-21) | 240 | 165 | 3.630 | 18.800 | 32.000 | -13.200 |
| Q8 (M22-24) | 320 | 230 | 5.060 | 26.200 | 35.000 | -8.800 |
| Q9 (M25-27) | 385 | 280 | 6.160 | 33.200 | 38.000 | -4.800 |
| Q10 (M28-30) | 480 | 360 | 7.920 | 42.500 | 40.000 | +2.500 |
| Q11 (M31-33) | 560 | 430 | 9.460 | 51.000 | 42.000 | +9.000 |
| Q12 (M34-36) | 650 | 500 | 11.000 | 60.500 | 44.000 | +16.500 |

ARR de salida a M36 ≈ USD 132.000. Break-even operativo mensual proyectado
≈ mes 28-29.

### Cash flow — vista anual **[D]**

| | Año 1 | Año 2 | Año 3 |
|---|---:|---:|---:|
| Caja inicial (ronda recomendada cerrada en M0) | 115.000 | 39.360 | 4.760 |
| Ingresos operativos | 7.740 | 75.100 | 187.200 |
| OPEX (incl. founder salary) | 81.000 | 137.500 | 159.000 |
| CAPEX | 2.000 | 1.500 | 1.500 |
| Burn neto del período | -75.260 | -63.900 | +26.700 |
| **Caja final** | **39.360** | **4.760** (¹) | **31.460** |

(¹) La caja de cierre de Año 2 queda ajustada a propósito — señal de que la
ronda recomendada financia ~18 meses, y una ronda puente o Serie A debe
cerrarse alrededor del mes 15-18 (milestone M7, sección 14).

### Balance sheet — simplificado, fin de cada año **[D]**

| | Fin Año 1 | Fin Año 2 | Fin Año 3 |
|---|---:|---:|---:|
| Activo — Caja | 39.360 | 4.760 | 31.460 |
| Activo — Cuentas por cobrar | 500 | 1.500 | 5.500 |
| Activo — Equipo/CAPEX neto | 1.500 | 2.000 | 2.200 |
| **Total activo** | **41.360** | **8.260** | **39.160** |
| Pasivo — Cuentas por pagar | 6.750 | 11.500 | 13.200 |
| Pasivo — Deuda financiera | 0 | 0 | 0 |
| Patrimonio | 34.610 | -3.240 | 25.960 |

Sin deuda financiera en ningún escenario — coherente con la estructura de
inversión recomendada (sección 10). El modelo de suscripción cobra por
adelantado, cuentas por cobrar mínimas.

### Burn rate y runway

| | |
|---|---|
| Burn mensual inicial (M1-3) | ≈ USD 6.000/mes |
| Burn mensual pico (M16-24) | ≈ USD 12.000/mes |
| Break-even operativo | ≈ Mes 28-29 |

---

## 6 · Ronda de inversión

Capital necesario = producto + infraestructura + founder salary + equipo +
comercialización + legal + administración + contingencia + working
capital, sostenido durante un runway definido — no "lo que costó construir
el software".

| Partida (mensual, promedio del período) | 12 meses | 18 meses | 24 meses |
|---|---:|---:|---:|
| Founder salary (USD 2.000/mes) | 24.000 | 36.000 | 48.000 |
| Infraestructura/tech | 2.000 | 3.600 | 5.800 |
| Equipo (1 hire part-time desde mes 4/6) | 9.600 | 18.000 | 32.000 |
| Comercialización / adquisición de comercios | 9.000 | 18.000 | 30.000 |
| Legal (constitución, DNDA, ToS/privacidad, contratos) | 9.000 | 11.600 | 14.000 |
| Administración / contabilidad | 1.800 | 2.700 | 3.600 |
| **Subtotal** | 55.400 | 89.900 | 133.400 |
| Contingencia (~15%) | 8.300 | 13.500 | 20.000 |
| Working capital / buffer | 6.000 | 10.000 | 15.000 |
| **Total** | **69.700** | **113.400** | **168.400** |

| Escenario | Capital | Runway | Nota |
|---|---:|---|---|
| Ronda mínima | USD 60.000 | 12 meses | Sin contratación, comercialización founder-led. Riesgo alto: sin margen si algo falla |
| **Ronda recomendada** | **USD 115.000** | **18 meses** | 1 contratación part-time desde mes 4-6. Milestones M0-M5 completos, listo para levantar la siguiente ronda con datos reales |
| Ronda de aceleración | USD 200.000 | 24 meses | Equipo más grande, comercialización agresiva. Sólo defendible si el inversor aporta distribución real que acelere la curva de adopción |

---

## 7 · Founder salary

Costo operativo necesario para dedicación de tiempo completo, no un
beneficio personal.

| | |
|---|---|
| Salario mínimo sostenible | USD 1.200/mes **[C]** |
| Salario de mercado (referencia) | USD 2.500-4.000/mes **[E — validar contra encuesta salarial IT actualizada]** |
| **Salario recomendado para esta etapa** | **USD 2.000/mes [C]** |
| Impacto mensual sobre el burn | USD 2.000/mes (~25-30% del OPEX mensual de la ronda recomendada) |
| Impacto sobre runway (ronda de 18 meses) | USD 36.000 de USD 115.000 (31%) |

---

## 8 · Estructura de equity

POST-MONEY = PRE-MONEY + INVERSIÓN &nbsp;·&nbsp; % INVERSOR = INVERSIÓN ÷
POST-MONEY. Base: pre-money escenario BASE (USD 380.000), con filas de
sensibilidad usando los pre-money conservador y optimista.

| Inversión (USD) | Pre-money (USD) | Post-money (USD) | % Inversor | % Founder | Lectura |
|---:|---:|---:|---:|---:|---|
| 40.000 | 380.000 | 420.000 | 9,5% | 90,5% | Insuficiente — no cubre la ronda mínima |
| 60.000 | 380.000 | 440.000 | 13,6% | 86,4% | Ronda mínima (12m) |
| 80.000 | 380.000 | 460.000 | 17,4% | 82,6% | Atractiva para ambos — barata para el inversor |
| 100.000 | 380.000 | 480.000 | 20,8% | 79,2% | Entra al rango considerado razonable |
| **115.000** | **380.000** | **495.000** | **23,2%** | **76,8%** | **Ronda recomendada — el escenario a negociar** |
| 130.000 | 380.000 | 510.000 | 25,5% | 74,5% | Límite superior de lo razonable |
| 150.000 | 380.000 | 530.000 | 28,3% | 71,7% | Empieza a ser caro sin justificación de milestone extra |
| 200.000 | 380.000 | 580.000 | 34,5% | 65,5% | Ronda de aceleración — sólo si el aporte estratégico lo justifica |
| 115.000 | 180.000 (pre conservador) | 295.000 | 39,0% | 61,0% | Demasiado caro para la founder con este pre-money |
| 115.000 | 650.000 (pre optimista) | 765.000 | 15,0% | 85,0% | Demasiado barato para el inversor sin evidencia de tracción |
| 250.000 | 380.000 | 630.000 | 39,7% | 60,3% | Fuera de rango — se acerca a pérdida de mayoría de control efectivo |

**Lectura:** el rango USD 80.000–130.000 de inversión contra el pre-money
base (17%–25,5% de equity) coincide con lo que la founder había
considerado razonable antes de hacer la cuenta — la coincidencia valida el
pre-money base, no al revés. El punto de USD 115.000 / 23,2% cubre el
runway recomendado completo con dilución defendible.

---

## 9 · Aporte no monetario de los inversores

Un inversor con PyME propia y experiencia de gestión puede aportar valor
real. Regla: separar lo que aportan de caja, de lo estratégico, y de lo
operativo — y no convertir promesas futuras en equity inmediato sin
mecanismo.

- **Cash contribution:** el capital invertido — lo único que compra equity por defecto, al valor de la sección 8.
- **Strategic contribution:** contactos, acceso a clientes B2B, credibilidad de marca, know-how de escalar una PyME argentina real (fiscal, laboral, logístico).
- **Operational contribution:** administración, contabilidad, estructura comercial, procesos de venta, infraestructura compartida — reduce el OPEX proyectado si se concreta.

### Mecanismos para no regalar equity por promesas

| Mecanismo | Recomendación |
|---|---|
| Equity inmediato | Usar — sólo por el capital efectivamente aportado |
| Vesting (del inversor-operador, si toma rol activo) | Evaluar sólo si asumen un rol operativo real y sostenido |
| Earn-out | No aplica hoy — no hay un activo concreto a transferir |
| **Milestone-based equity** | **Recomendado** — tramo adicional condicionado a metas de distribución/comercialización verificables, no a la promesa genérica |
| Advisor shares | Reservar 0,5-1,5% si alguien sólo asesora, sin invertir capital propio |
| Sweat equity | No aplica a un inversor que ya recibe equity por su capital |
| Equity sujeto a objetivos (ratchet) | Usar con cautela — requiere asesoría legal específica |

**Recomendación concreta:** el capital aportado compra el % de la sección
8. Si además quieren un tramo por su aporte estratégico/operativo, que sea
un pool aparte (ej. 3-5% adicional), liberado en tramos verificables —
nunca una promesa sin métrica.

---

## 10 · Estructura de la inversión

| Instrumento | Para este caso |
|---|---|
| **Equity directo** | **Recomendado** — alinea incentivos de gestión inmediatamente, clave dado que el inversor quiere aportar gestión, no sólo capital |
| SAFE | No recomendado para este perfil — diseñado para inversores pasivos, encaja mal con un socio que quiere gestionar desde ya |
| Convertible note | Sólo si el equity directo no se puede cerrar a tiempo |
| Préstamo | Descartar — Staffya no genera caja para repagar deuda hoy; no confundir inversión con préstamo |
| Revenue-based financing | Prematuro — requiere ingresos recurrentes ya existentes para calibrar el repago |
| Equity + préstamo | Sólo en condiciones excepcionalmente blandas |
| **Equity por etapas (tranches)** | **Recomendado como complemento** — ej. 60% al cierre, 40% al alcanzar el milestone M3 |

> **Requiere asesoría profesional, no es asesoramiento legal/fiscal
> definitivo.** Para Argentina, un abogado y un contador deben confirmar
> antes de cerrar: tipo societario (SAS vs SA), tratamiento impositivo del
> aporte y de un eventual pool de equity por milestones, si el/los
> inversores entran como personas físicas o vía su propia sociedad, y
> cláusulas de salida bajo la Ley General de Sociedades.

---

## 11 · Term sheet conceptual (borrador de discusión, no vinculante)

| Cláusula | Contenido propuesto | Etiqueta |
|---|---|---|
| Inversión | USD 115.000, 2 tramos (60% cierre / 40% al milestone M3) | Negociable |
| Valuación pre-money | USD 380.000 | Negociable |
| Porcentaje | 23,2% inversor / 76,8% founder | Negociable |
| Destino de fondos | Según sección 13, reporte trimestral de desvíos >15% | Normal |
| Derechos de los inversores | Information rights, 1 asiento de directorio, pro-rata en próximas rondas | Normal |
| Governance / Board | 3 asientos: founder + inversor + independiente (sección 12) | Negociable |
| Voting rights | 1 voto = 1 acción; reserved matters con mayoría calificada | Normal |
| Reserved matters | Venta de la empresa, nueva ronda, endeudamiento >USD 20.000, cambio de objeto, venta de IP | Normal |
| Founder vesting | No aplica al equity fundacional de la founder frente a un inversor pasivo | Riesgosa si se aplica mal |
| Anti-dilution | Weighted-average broad-based (estándar) | Requiere asesoramiento legal |
| Right of first refusal | Sobre venta de acciones del founder a terceros | Normal |
| Tag-along / Drag-along | Umbral alto para drag (>75%), nunca uno que el inversor solo pueda alcanzar | Riesgosa si el umbral es bajo |
| Liquidation preference | 1x no participante | Requiere asesoramiento legal |
| IP ownership | Toda la IP en la sociedad | Requiere asesoramiento legal |
| Non-compete | Nunca sobre la founder hacia afuera del sector | Requiere asesoramiento legal |
| Founder employment/management role | Founder mantiene autoridad final sobre roadmap y decisiones técnicas | Riesgosa si no se deja explícito |

---

## 12 · Gobierno / junta directiva

**Composición inicial:** directorio de 3 — Founder (presidenta, voto de
calidad), 1 representante del inversor, 1 independiente acordado por
ambos.

| Decisión | Requiere |
|---|---|
| Roadmap de producto, prioridades técnicas, contratación de ingeniería | Sólo founder |
| Presupuesto dentro de lo ya aprobado | Sólo founder |
| Gastos fuera del uso de fondos aprobado (>USD 5.000) | Mayoría de directorio |
| Contratación de roles de gerencia | Mayoría de directorio |
| Endeudamiento >USD 20.000 | Aprobación del inversor (reserved matter) |
| Nueva ronda / emisión de acciones | Aprobación del inversor (reserved matter) |
| Venta de la empresa / M&A | Aprobación del inversor + mayoría calificada |
| Cambio de objeto social | Aprobación del inversor |
| Venta o licenciamiento de IP | Aprobación del inversor |

**Reporte:** mensual (caja, MRR/comercios activos, riesgos) + trimestral
(P&L real vs. proyectado, revisión de milestones).

---

## 13 · Uso de los fondos (ronda recomendada, USD 115.000, 18 meses)

| Categoría | % | Monto (USD) | Milestone vinculado |
|---|---:|---:|---|
| Founder salary | 31% | 36.000 | Dedicación full-time — condición de todos los milestones |
| Product | 7% | 8.000 | M2 — producto estabilizado |
| Infrastructure / Cloud | 3% | 3.600 | Transversal |
| Legal | 10% | 11.600 | M0 — constitución, cierre de ronda, DNDA |
| Accounting / Administración | 2% | 2.700 | Transversal |
| Marketing / Sales / Customer acquisition | 16% | 18.000 | M3-M4 — primeros comercios pagos |
| Operations (equipo part-time) | 16% | 18.000 | M4-M5 — soporte sin cuello de botella en la founder |
| Working capital | 9% | 10.000 | Buffer de caja |
| Contingencia | 12% | 13.500 | No asignada |

---

## 14 · Milestones

| Hito | Objetivo | Métrica | Deadline | Presupuesto | Criterio de éxito |
|---|---|---|---|---:|---|
| M0 | Ronda cerrada, sociedad constituida | Fondos en cuenta, SAS inscripta | Mes 0-1 | 11.600 | Capital disponible, estructura legal lista |
| M1 | Producto estabilizado post-beta | Bugs críticos resueltos, backup ensayado, CI con secret-scanning | Mes 2-3 | 8.000 | Cero incidentes de datos/seguridad en 30 días |
| M2 | Monetización activa | `subscriptions_enforced=true`, MP configurado | Mes 3-4 | 2.000 | ≥10 comercios pagos |
| M3 | Primeros clientes reales medidos | Tiempo de cobertura <10 min en ≥50% de turnos | Mes 4-6 | 18.000 | ≥25 comercios activos, funnel documentado |
| M4 | Revenue repetible | MRR creciendo, churn medido <8%/mes | Mes 7-9 | 18.000 | ≥25 comercios pagos |
| M5 | Ventas sin la founder en cada onboarding | Proceso delegable, primera contratación | Mes 9-12 | 18.000 | ≥45 comercios pagos, 1 persona part-time operando |
| M6 | Break-even a la vista | MRR ≈ USD 2.600-3.000 | Mes 15-18 | 18.000+contingencia | ≥120 comercios activos, ≥80 pagos |
| M7 | Siguiente ronda | Métricas reales para Serie semilla/A | Mes 15-18 | — | Term sheet en negociación antes de agotar runway |

---

## 15 · Data room — estructura

| Carpeta | Contenido |
|---|---|
| 00 · Executive Summary | One-pager, este documento como maestro |
| 01 · Company | Constitución societaria (**DATO FALTANTE**), estatuto, cap table |
| 02 · Founder | CV, historia del proyecto |
| 03 · Product | `docs/foundation/PRODUCT.md`, `DOMAIN.md`, demo en vivo |
| 04 · Technology | `ARCHITECTURE.md`, los 11 ADRs, `DUE_DILIGENCE_REPORT.md` |
| 05 · Intellectual Property | `LICENSE`, `NOTICE`, checklist DNDA |
| 06-07 · Market / Competition | Sección 4 de este documento |
| 08 · Business Model | `ADR-0005` |
| 09 · Financial Model | Sección 5 en hoja de cálculo editable |
| 10 · Fundraising | Secciones 6-8-11 |
| 11 · Legal | Términos, privacidad, pendiente entidad legal |
| 12 · Operations | `docs/reference/DEPLOY.md`, runbooks, post-mortems |
| 13 · Security | `docs/reference/SECURITY.md`, auditoría OÍDO |
| 14 · Metrics | Pendiente de poblar con datos reales de la beta |
| 15 · Roadmap | `ROADMAP_IMPLEMENTATION.md`, milestones (sección 14) |
| 16 · Investor Materials | Deck (sección 17), term sheet, este documento |

---

## 16 · Documentos para una reunión con inversores

| Doc | Cuándo |
|---|---|
| A · One-Pager | Hoy |
| B · Executive Summary | Hoy (sección 0) |
| C · Investor Deck | Hoy (sección 17) |
| D · Financial Model (hoja de cálculo) | Después — mencionar que existe |
| E · Valuation Memo | Resumen hoy, completo después |
| F · Use of Funds | Hoy (sección 13) |
| G · Cap Table | Hoy (sección 8) |
| H · Fundraising Proposal | Hoy (secciones 6-8) |
| I · Founder Compensation Proposal | Hoy (sección 7) |
| J · Product/Technology Dossier | Después — `DUE_DILIGENCE_REPORT.md` a mano por si preguntan |
| K · Roadmap | Hoy (sección 14) |
| L · Term Sheet conceptual | Hoy como borrador — nunca para firmar en la reunión |
| M · Due Diligence Checklist | Hoy |
| N · Board/Governance Proposal | Después de acordar el monto |

---

## 17 · Investor deck (15 slides)

| # | Slide | Contenido |
|---:|---|---|
| 1 | Cover | Staffya — "Cubrir un turno gastronómico eventual en menos de 10 minutos" |
| 2 | Problem | Staffing eventual hoy = WhatsApp + contactos + azar. Sector con caída de consumo 20-30% interanual 2025 |
| 3 | Solution | Marketplace en tiempo real, ciclo completo con check-in/out geolocalizado |
| 4 | Product | Screenshots reales: feed swipe, mapa, wizard con IA, chat, panel comercio |
| 5 | Why now | Presión de costos en gastronomía, PWA+IA generativa bajan el costo de construir, sin competidor local directo verificado |
| 6 | Market | SOM >13.000 locales CABA (fuente GCBA/Infobae), SAM/TAM bottom-up |
| 7 | Business model | Mensualidad escalonada (ADR-0005), construida y apagada a propósito hasta calibrar precio |
| 8 | Competitive advantage | Reputación real derivada del ciclo del turno, densidad geográfica (Palermo) |
| 9 | Technology / moat | 17 módulos, arquitectura hexagonal, 500+ tests, documentación exhaustiva |
| 10 | Traction | Honesto: beta iniciada 15/08/2026, reclutamiento en curso, sin inflar |
| 11 | Financial projections | Curva de adopción y break-even a 36 meses, marcado como escenario |
| 12 | Roadmap | M0-M7 |
| 13 | Fundraising | USD 115.000, pre-money USD 380.000, 23,2% |
| 14 | Use of funds | Gráfico de la sección 13, vinculado a milestones |
| 15 | Team / founder | Julieta Arrazate — fundadora y desarrolladora responsable de todo el producto mostrado |

---

*Fuente: sesión de auditoría técnica/financiera del repositorio, 2026-08-26.
Ver `DUE_DILIGENCE_REPORT.md` en la raíz para la auditoría externa previa
(perspectiva CTO/seguridad/inversor) que sirvió de base a varios hallazgos
de la sección 1.*
