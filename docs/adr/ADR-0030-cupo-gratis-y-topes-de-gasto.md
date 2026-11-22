# ADR-0030 — Cupo gratis por defecto y topes de gasto en cada integración

**Estado:** aceptado · **Fecha:** 2026-11-22 · **Decisión de Julieta:**
2026-11-22 («siempre usamos el cupo free, no nos pasamos de eso»).

## Contexto

Oído corre sobre servicios con plan gratis (Neon, Vercel, Cloudinary, Resend,
Sentry, Gemini, Cloudflare, GitHub, Zernio). El riesgo que quiere evitar
Julieta es conocido: un producto anda bien en pruebas, llegan usuarios reales,
algún servicio pasa su límite y aparece un cargo que nadie esperaba. Pasa
sobre todo con servicios que **cobran el excedente** en vez de **cortar**, y
con APIs cuya clave está atada a una cuenta con tarjeta.

## Decisión

1. **Plan gratis por defecto.** Ningún servicio pasa a pago sin el «sí»
   explícito de Julieta, anotado en la tabla de abajo. Única excepción vigente:
   Render Starter (USD 7 fijos por mes, decidido el 2026-11-18).
2. **Mejor que corte a que cobre.** Si un servicio puede funcionar sin tarjeta,
   no se le carga tarjeta. Si la exige, se configura un tope de gasto o una
   alerta de facturación en el valor más bajo que permita.
3. **Tope propio por debajo del cupo.** Toda integración que llama a una API
   externa desde la app tiene un tope diario o mensual en Oído, debajo del
   cupo gratis (como referencia, 80 %), y al llegar al tope **degrada con un
   mensaje claro** en vez de seguir llamando. El patrón ya existe: los topes
   diarios de Gemini (`gemini_daily_limit_*` en `backend/app/core/config.py`) y
   el «flag por ausencia» (sin clave, la función se apaga sola).
4. **Integración nueva = fila nueva acá**, en el mismo PR: qué cupo gratis
   tiene, qué pasa al pasarlo (corta o cobra), qué tope pone Oído y cómo se
   mira el consumo.
5. **Generaciones que gastan créditos** (videos, voces, imágenes con IA) se
   piden de a una y con el «sí» de Julieta.

## Inventario (al 2026-11-22)

«Verificado» = mirado con las herramientas de la sesión. «A verificar» =
lo tiene que mirar Julieta en el panel del servicio (lista en `STATUS.md`).

| Servicio | Para qué | Plan | Si se pasa del cupo | Tope o resguardo hoy | Falta |
|---|---|---|---|---|---|
| Neon | Base de datos | Gratis (verificado: proyecto `staffya-us-east`, máximo 0,25 CU, 1 GB por rama) | Se suspende el cómputo hasta el mes siguiente; el plan gratis no cobra | Autoescala tope 0,25 CU | No cargar tarjeta ni subir de plan sin ADR |
| Render | Backend y scheduler | Starter USD 7/mes (decidido) | Instancia de precio fijo | — | A verificar: una sola instancia, sin autoescalado, y alerta de facturación |
| Vercel | Frontend | A verificar (equipo personal; se espera Hobby) | Hobby no cobra: pausa | — | A verificar plan y que no haya «Spend Management» en Pro |
| Gemini (Google) | Describí el turno, asistentes, soporte | A verificar | **Si el proyecto de Google tiene facturación activa, cobra** | Topes diarios: 500, 200, 250 y 50 llamadas | A verificar que el proyecto de la clave **no tenga facturación**; si la tiene, presupuesto con alerta |
| Cloudinary | DNI, selfies y CV | Gratis (a verificar) | El plan gratis corta las subidas | Los documentos se borran tras decidir (ADR-0021) | A verificar que no haya plan pago ni tarjeta |
| Resend | Mails | Gratis (a verificar) | Rechaza envíos; no cobra | Envío best-effort | — |
| Sentry | Errores | Gratis (a verificar) | Descarta eventos | Muestreo de trazas 0,1 | A verificar que el presupuesto pay-as-you-go esté en USD 0 |
| Cloudflare | Turnstile, webhook de pagos (ADR-0018) | Gratis | Los Workers gratis devuelven error; no cobran | — | — |
| Google Sign-In | Ingreso con Google | Gratis | — | — | — |
| CARTO (mapas) | Estilo y mosaicos del mapa | Gratis, sin clave (ADR-0001) | — | — | **A verificar las condiciones de uso comercial** de los basemaps |
| OpenStreetMap (Overpass) | Comercios a captar | Gratis, uso razonable | Rechaza pedidos | Copia semanal, no en vivo (ADR-0029) | — |
| GitHub Actions | CI y la copia mensual de Overture | Gratis | Con límite de gasto en USD 0, se frena | — | A verificar límite de gasto en USD 0 |
| Zernio | Comentario → mensaje privado | Gratis: 2 cuentas, 10.000 mensajes y 2.000 respuestas automáticas por mes | **Sin tarjeta, desde el 1/12 se pausa** en 2.000 por mes; con tarjeta cobra USD 2 cada 1.000 | Sin tarjeta (decisión de este ADR) | Si se llega al tope, se decide con Julieta |
| Mercado Pago | Cobro a comercios | Apagado | Comisión por cobro, solo cuando se cobra | Apagado hasta el 28/2 | — |
| ElevenLabs y similares | Voces, video, imágenes | Créditos | Gasta créditos | Regla 5 | — |

## Consecuencias

- Puede pasar que algo deje de funcionar por haber llegado al cupo (por
  ejemplo, las respuestas automáticas de Zernio si un video se vuelve viral).
  Es el costo aceptado: preferimos que se frene a recibir un cargo. Cuando
  pase, se decide con Julieta si conviene pagar ese mes.
- Pendiente de código (no urgente): una vista en `/admin/metricas` con el
  consumo de cada tope propio (hoy, el de Gemini) para ver de antemano si
  algo se acerca al límite.
