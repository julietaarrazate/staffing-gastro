# ADR-0025 — Encuesta para locales: módulo propio, sin IP, contacto a 12 meses

**Estado:** aceptado · **Fecha:** 2026-11-17 · **Pedido:** Julieta (campaña de diciembre)

## Contexto

Para la campaña de diciembre se necesita una encuesta pública de unos 3
minutos, que se comparte por WhatsApp. Mide cómo usan personal eventual los
locales (para fijar precios y dimensionar el mercado) y junta locales
interesados en la beta. La responde gente sin cuenta, desde el celular.

## Decisión

1. **Módulo propio `encuesta`, no una extensión de `lead`.** Un lead es un
   comercio que salió de OpenStreetMap: `osm_ref` y coordenadas son
   obligatorios y la lista se arma para salir a captar (ADR-0019). Una
   respuesta de la encuesta no tiene nada de eso y tiene otro ciclo de vida
   (anónima, con borrado programado). Mezclarlas obligaba a hacer opcionales
   campos que el resto del módulo da por seguros. Si un local quiere la
   beta, la admin lo ve en la lista de «Encuesta» y, si quiere, lo carga
   como lead a mano.
2. **Respuestas estructuradas, no texto libre.** Opciones cerradas para
   poder contar (resumen con distribuciones y mediana del pago por jornada).
   El único texto libre es el barrio y el contacto.
3. **Sin IP.** La respuesta no guarda IP ni agente de navegador. El límite de
   pedidos por IP (`RateLimiter`, 20 cada 10 min) vive en memoria y no deja
   rastro. La fuente de la visita es el `?ref=` del link, un texto corto que
   pone quien comparte.
4. **Contacto opcional, con consentimiento y retención de 12 meses.** Nombre,
   local, teléfono y email son opcionales; si hay cualquiera, el servidor
   exige el consentimiento y guarda cuándo se dio (`consent_at`). Quien
   marca que quiere la beta tiene que dejar teléfono o email. A los 12 meses
   de `created_at` el chequeo `run_survey_retention` (scheduler existente,
   una pasada por día, entra por `extra_checks`) borra esos cuatro campos y
   la respuesta queda como estadística anónima. Va en la política de
   privacidad (sección «Encuesta para locales»; sube `LEGAL_TERMS_VERSION`).
5. **Idempotencia sin cuenta.** `core/idempotency.py` ata la clave a un
   usuario con sesión (FK a `users`), y acá no hay. La clave del header
   `Idempotency-Key` se guarda en la propia respuesta (`client_key`, única):
   un reintento del mismo intento no duplica y responde igual. No se tocó
   el mecanismo general.
6. **Anti-abuso sin Turnstile:** límite por IP, un honeypot que descarta en
   silencio (responde 201 sin guardar) y validación de rangos (pago por
   jornada entre $5.000 y $1.000.000).

## Consecuencias

- Tabla nueva `survey_responses` (migración 0046).
- `POST /api/v1/encuesta` es de los pocos endpoints públicos de escritura;
  su límite es por proceso, como el resto (ver `SECURITY.md`).
- Las respuestas de más de 12 meses conservan tipo de local, barrio, rangos,
  puestos, canales, pago y preferencia de precio; pierden quién eran.
- Si la encuesta se vuelve permanente, conviene sumar Turnstile (como en el
  registro) antes de difundirla fuera de la campaña.
