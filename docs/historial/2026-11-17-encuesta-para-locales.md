# Encuesta para locales (`/encuesta`)

**Pedido:** Julieta, para la campaña de diciembre: una encuesta pública de
unos 3 minutos que se comparte por WhatsApp. Mide cómo usan personal
eventual los locales (para fijar precios y dimensionar el mercado) y junta
locales interesados en la beta.

**Qué cambió:** 
- Pantalla pública `/encuesta`: una pregunta por pantalla (11 pasos), barra
  de avance, Atrás/Siguiente, opciones grandes, el cielo de la landing
  arriba, un solo ámbar en el botón de seguir. Paso final de contacto,
  opcional, con consentimiento y link a `/privacidad`. `?ref=` guarda qué
  grupo la trajo. Sin barras de la app (`Navbar`, `BottomNav`), fuera de los
  buscadores (`robots.ts` y `metadata`). Lo contestado queda en
  `sessionStorage` hasta enviar. `frontend/components/encuesta/`,
  `frontend/lib/encuesta.ts`.
- Backend: módulo `backend/app/modules/encuesta/` (`SurveyResponse`),
  migración `0046_encuesta_locales`. `POST /api/v1/encuesta` público (límite
  por IP, honeypot, `Idempotency-Key`), `GET /admin/encuesta` y
  `GET /admin/encuesta/summary` sólo admin.
- Retención: `run_survey_retention` (scheduler, una vez por día) borra
  nombre, local, teléfono y email a los 12 meses.
- Admin: en `/admin/leads` («Crecimiento») pestaña «Encuesta» con el resumen
  y los locales que dejaron contacto (`components/admin/EncuestaPanel.tsx`).
- Privacidad: sección «Encuesta para locales» y `LEGAL_TERMS_VERSION`
  `2026-11-17-1` (backend y `frontend/lib/legal.ts`).
- Tests: `backend/tests/test_encuesta.py`, `frontend/lib/encuesta.test.ts`,
  `frontend/e2e/encuesta.spec.ts`, `frontend/e2e/admin-encuesta.spec.ts`.

**Por qué así:** ADR-0025. Módulo propio y no un lead (los leads salen de
OpenStreetMap), sin IP, contacto con retención de 12 meses. La
idempotencia usa una clave guardada en la propia respuesta porque
`core/idempotency.py` exige un usuario con sesión.

**Queda abierto:** Turnstile en la encuesta si se difunde más allá de la
campaña; cargar a mano como lead a quien quiera la beta (no hay botón).
