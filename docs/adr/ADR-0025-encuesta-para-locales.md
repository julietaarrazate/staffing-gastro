# ADR-0025 — Encuesta para locales: módulo propio, sin IP, contacto mientras dure la beta

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
   poder contar. La primera pregunta, obligatoria, es el rol de quien
   contesta (dueño, encargado, trabaja en el local, otro); el nombre del
   local y el barrio también son obligatorios. El resumen de admin calcula
   las distribuciones y la mediana del pago por jornada **sólo con las
   respuestas de dueños y encargados**, que son quienes deciden y pagan, y
   muestra aparte el total y cuántas son de quien decide; la lista muestra
   todas, con el rol. Otros textos libres: el barrio, el nombre del local y
   el contacto.
3. **Sin IP.** La respuesta no guarda IP ni agente de navegador. El límite de
   pedidos por IP (`RateLimiter`, 20 cada 10 min) vive en memoria y no deja
   rastro. La fuente de la visita es el `?ref=` del link, un texto corto que
   pone quien comparte.
4. **Contacto opcional, con consentimiento, guardado mientras dure la beta y
   el lanzamiento.** Nombre, teléfono y email son opcionales; si hay
   cualquiera, el servidor exige el consentimiento y guarda cuándo se dio
   (`consent_at`). Quien marca que quiere la beta tiene que dejar teléfono o
   email. **No hay borrado automático por plazo** (se evaluó uno a los 12
   meses y se descartó: el contacto sirve mientras dure la beta y el
   lanzamiento, y ese fin no tiene fecha fija). En cambio:
   - la admin puede **borrar el contacto de una respuesta** («Borrar
     contacto» en `/admin/leads` → Encuesta, con confirmación en la página;
     `POST /admin/encuesta/{id}/borrar-contacto`, idempotente, 404 si no
     existe), que es lo que se usa cuando alguien lo pide por mail;
   - al terminar la beta y el lanzamiento se borra **el contacto de todas**
     con `backend/scripts/clear_survey_contacts.py` (`SurveyService.clear_all_contacts`;
     dry-run por defecto, `--apply` para borrar), sin botón en la interfaz.
   Borrar quita nombre, teléfono y email. **El nombre del local se
   conserva:** es el nombre de un comercio, no un dato personal, y permite no
   contar dos veces a un mismo local. Va en la política de privacidad (sección «Encuesta para locales»; sube `LEGAL_TERMS_VERSION`).
5. **Idempotencia sin cuenta.** `core/idempotency.py` ata la clave a un
   usuario con sesión (FK a `users`), y acá no hay. La clave del header
   `Idempotency-Key` se guarda en la propia respuesta (`client_key`, única):
   un reintento del mismo intento no duplica y responde igual. No se tocó
   el mecanismo general.
6. **Anti-abuso sin Turnstile:** límite por IP, un honeypot que descarta en
   silencio (responde 201 sin guardar) y validación de rangos (pago por
   jornada entre $5.000 y $1.000.000).

## Consecuencias

- Tabla nueva `survey_responses` (migración 0047).
- `POST /api/v1/encuesta` es de los pocos endpoints públicos de escritura;
  su límite es por proceso, como el resto (ver `SECURITY.md`).
- Una respuesta sin contacto conserva rol, nombre del local, tipo de
  local, barrio, rangos, puestos, canales, pago y preferencia de precio;
  pierden nombre, teléfono y email.
- Si la encuesta se vuelve permanente, conviene sumar Turnstile (como en el
  registro) antes de difundirla fuera de la campaña.
