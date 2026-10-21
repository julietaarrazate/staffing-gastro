# Propuesta: cubrir el turno en minutos (matching, plan B, costos e identidad)

**Estado:** propuesta para ir puliendo, no decidida. Si una parte se aprueba,
pasa a un ADR propio. **Fecha:** 2026-10-14 (actualizada el 2026-10-20).

Sale de comparar Oído con las notas de ingeniería inversa del laboratorio
(Qwick, Instawork, TitoFree, inDrive, despacho de Uber/Rappi) contra el código
vigente: `matching/domain/scoring.py`, `shift/application/services.py`
(`publish_shift`, `_notify_nearby_workers`, `escalate_urgency`,
`assign_worker`, `confirm_assignment`) y `shift/application/scheduler.py`.

## 1. Dónde está parada Oído

| | TitoFree (local) | Qwick / Instawork (EE.UU.) | Oído hoy |
|---|---|---|---|
| Promesa | Postulantes rápido | Turno cubierto | Turno cubierto en menos de 10 min |
| Tomar el turno | Postulación y entrevista | Confirmación instantánea si es urgente | Postula → el comercio elige → el trabajador confirma |
| Si nadie responde | Nada | Bono visible, acceso anticipado por nivel | Una escalada a los 8 min (ADR-0009) |
| Avisos | Push + WhatsApp | Push nativo, SMS, llamada | Solo Web Push |
| Pago al trabajador | No | Sí, rápido | No (post-beta) |

**Ventajas de Oído:** privacidad de ubicación (ADR-0014), verificación del
comercio (ADR-0013), pago de referencia (ADR-0012) y escalada automática.

**Cuello de botella:** cubrir depende de tres decisiones humanas en cadena
(postularse, que el comercio entre y elija, confirmar). Si el comercio no mira
el celular, el turno no se cubre aunque haya gente dispuesta.

## 2. Matching más simple para lo urgente

### 2.1 "El primero que toma, se lo queda" (solo turnos urgentes)

Un toque del trabajador asigna y confirma a la vez. La carrera ya está
resuelta por el bloqueo optimista (ADR-0016): gana el primero y el resto ve
"ya se cubrió". Los turnos planificados siguen con postulación y elección del
comercio, como Qwick. El comercio elige el modo al publicar; si el turno
empieza en menos de X horas, se sugiere "urgente".

### 2.2 Filtrar y después ordenar (en vez de cinco pesos)

Hoy: distancia 0,30, reputación 0,25, experiencia/puntualidad/desempeño 0,15
cada uno (`matching/domain/value_objects.py`). Para lo urgente:

- **Filtros sí/no:** tiene el puesto, está disponible, llega a tiempo, no está
  comprometido en otro turno que se solape.
- **Orden:** ① ya trabajó en el local o es favorito ② "Disponible ahora"
  prendido ③ más cerca ④ sin ausencias sin aviso. Experiencia y rating, solo
  desempate.

### 2.3 Radio realista

`DEFAULT_MAX_RADIUS_KM = 25` y la escalada lo lleva a 40 km. Para cubrir en
minutos en Palermo, empezar por 3–5 km y ampliar por tandas. A futuro, medir
en minutos de viaje (Uber rankea por ETA, no por línea recta).

## 3. Plan B y C: cascada por tandas

| Minuto | Qué pasa |
|---|---|
| 0 | Tanda 1: favoritos, quienes ya trabajaron ahí y 5 "disponibles ahora" a menos de 5 km |
| 2 | Tanda 2: los 10 siguientes, hasta ~8 km |
| 4 | Al comercio: "subí el pago a $X" (usa `pay_benchmark`) |
| 6 | Tanda 3: radio amplio + respaldo por WhatsApp/SMS para quien no abrió el push |
| 8 | Al comercio: opciones concretas (subir pago, aceptar puesto parecido, correr horario) |

Requisitos técnicos:

- `shift_id` en `Notification`: evita avisos repetidos entre tandas (hoy
  aceptado como costo en ADR-0009) y permite medir quién vio qué.
- `escalated_at` pasa de marca única a etapa de la cascada (ADR-0009 ya lo
  prevé como "extensión natural").
- Los tiempos son valores semilla, ajustables con la métrica de cobertura del
  panel `/admin`.

Incentivos: no castigar rechazos (en Argentina puede indicar relación
laboral); premiar al que responde con un nivel que da acceso anticipado a los
urgentes, como Qwick e Instawork.

## 4. Infraestructura y costos (startup sin plata)

### 4.1 Riesgo más urgente: backend que se duerme

`render.yaml` usa `plan: free`. Render duerme un servicio free tras 15 minutos
sin tráfico y tarda ~1 minuto en despertar. El scheduler (escalada,
recordatorios, no-show) corre dentro de ese proceso: dormido, no corre. Sin
backend despierto, ninguna mejora de matching sostiene "minutos".

### 4.2 Cuentas

El front ya está en Cloudflare Workers Paid (USD 5/mes) desde el 2026-10-19
(ADR-0017, ítem 10 de `STATUS.md`). Lo que queda:

| Pieza | Hoy | Propuesta | Costo |
|---|---|---|---|
| Front | Cloudflare Workers Paid | — | USD 5 |
| Backend | Render free (se duerme) | Render Starter | USD 7 |
| Base | Neon free | — | USD 0 |
| **Total** | USD 5 | | **USD 12** |

- Render Starter es lo que tiene impacto directo en la promesa de los 10
  minutos: con el servicio dormido no corren la escalada ni los
  recordatorios.
- Cloudflare R2 (10 GB gratis) puede reemplazar a Cloudinary al salir de su
  plan gratis (ya planificado en #440).

## 5. Verificación de identidad

### 5.1 Cómo lo hacen otros

- **TitoFree:** fotos del DNI + video de presentación revisado por una persona.
- **Qwick / Instawork:** verificación de identidad + antecedentes (proveedor
  pago, EE.UU.) + certificados con vencimiento.
- **Uber / Rappi:** documento + selfie con prueba de vida, y selfie repetida
  al azar antes de conectarse.
- **Oído hoy:** DNI + selfie revisados por un admin (`admin_manual`), con el
  modelo de claims/evidencias de ADR-0010, que ya deja enchufar un proveedor
  o RENAPER como otro adaptador sin tocar el dominio.

### 5.2 Opciones

| Opción | Qué valida | Costo | Comentario |
|---|---|---|---|
| Revisión manual (hoy) | DNI + selfie, a ojo | USD 0, cuesta tiempo | Alcanza para la beta; no escala |
| Didit | Documento, prueba de vida pasiva, comparación de cara | Núcleo gratis según su web (hay fuentes que hablan de 500 por mes); extras desde ~USD 0,15 | Mejor opción gratis; confirmar precio vigente y dónde guarda los datos |
| Persona (programa startups) | Documento + selfie | 500 por mes gratis **por 12 meses**; después plan desde USD 250/mes o se desactiva | Trampa para una startup sin plata |
| RENAPER (directo o vía proveedor) | Contra la base oficial del Estado | Pago por consulta; trámite y requisitos de Ley 25.326 | El más fuerte en Argentina; para más adelante |

### 5.3 Recomendación

1. **Beta:** seguir con `admin_manual`.
2. **Cuando la cola manual moleste:** adaptador de Didit en el puerto de
   verificación (método `kyc_provider`), solo con el núcleo gratis. Antes:
   leer sus términos, confirmar región de datos y que se puedan borrar
   (ver `docs/reference/IDENTITY_DATA_RETENTION.md`), y actualizar
   `/privacidad` + `LEGAL_TERMS_VERSION` en el mismo PR.
3. **Con ingresos:** validación contra RENAPER para el nivel de garantía más
   alto.
4. Barato y útil ya: **selfie al azar** antes de un turno urgente (evita que
   una cuenta verificada la use otra persona).

## 6. Orden sugerido

1. Backend siempre despierto (Render Starter).
2. "El primero que toma" + radio de 3–5 km para urgentes.
3. Cascada por tandas con `shift_id` en notificaciones.
4. Respaldo por WhatsApp/SMS.
5. Didit como verificación automática cuando haga falta.

(El front a Cloudflare ya está hecho: ADR-0017, 2026-10-19.)

## Fuentes

- Render free: https://render.com/docs/free
- Persona startups: https://help.withpersona.com/articles/1XNnqukfZY9VamF2e7jkuJ.md
- Didit, costos de KYC: https://didit.me/blog/how-much-does-kyc-cost-pricing-models-hidden-fees-explained/
- Didit en Capterra: https://capterra.co.uk/software/1070408/Didit
- RENAPER SID: https://www.argentina.gob.ar/sid/modalidades-y-productos
