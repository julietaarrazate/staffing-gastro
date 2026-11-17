# Entrar con Google a una cuenta sin confirmar: ahora avisa por mail (U039)

**Pedido:** Julieta (2026-11-17, U039). Cuando alguien entra con Google a una
cuenta que existía con contraseña y mail sin confirmar, la cuenta se reclama
sin avisarle a nadie. Decisión: sigue reclamándose, y se avisa al mail de la
cuenta.

**Qué cambió:** al reclamar, la dirección de la cuenta recibe «Entraron a tu
cuenta de Oído con Google»: se entró con Google con ese mail; como no estaba
confirmado, la contraseña anterior dejó de servir y se cerraron las sesiones;
desde ahora se entra con Google o se vuelve a tener contraseña desde
`/recuperar`; y si no fue la persona, que escriba a hola@oido.com.ar. Sin IP
ni datos de quien entró.
- `backend/app/modules/notification/domain/email_templates.py`:
  `render_google_claimed_account_email_html`.
- `backend/app/modules/identity/application/services.py`:
  `_claim_unverified_account` llama a `_send_claimed_account_email`
  (best-effort como `_send_welcome_email`; el log lleva el id, no el mail).
- Tests en `backend/tests/test_google_auth.py`: un solo mail a esa dirección,
  un fallo del envío no impide el ingreso, y una cuenta ya verificada no lo
  recibe.
- Doc corregida: `docs/reference/ACCESO_MODERNO.md` (Feature 1, punto 2).

**Por qué así:** se descartó no reclamar (deja la cuenta compartida con quien
la creó con un mail ajeno, que es lo que arregló el 2026-10-10). El aviso
cierra el hueco de que la dueña original no se enteraba.

**Queda abierto:** nada.
