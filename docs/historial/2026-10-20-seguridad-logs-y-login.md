# Emails enmascarados en los logs y login más difícil de forzar

**Pedido:** Julieta, 2026-10-20, como parte de la revisión de seguridad
(ítem 11 de `../STATUS.md`, prioridad baja).

**Qué cambió:**

- **Emails en los logs.** `backend/app/core/log_privacy.py` (nuevo):
  `mask_email` (`j***@gmail.com`) y `email_log_key` (hash corto, para claves
  de limitadores). Se usan en `notification/infrastructure/*email_sender.py`,
  `admin/api/routes.py` (auditoría de "Ver como": quedan los ids) y
  `admin/bootstrap.py`. Los logs de Render y Sentry los lee más gente que la
  base.
- **Login que delataba qué emails existen.** `identity/application/services.py`:
  con un email inexistente, `authenticate` hace igual una verificación bcrypt
  contra un hash de relleno, así la respuesta tarda lo mismo.
- **Fuerza bruta rotando IPs.** `identity/api/routes.py`: además del límite
  por IP (10 por minuto), 20 intentos cada 15 minutos por email. La clave del
  limitador es el hash del email, porque el limitador la loguea en cada 429.
- Tests: `tests/test_log_privacy.py` y
  `test_login_rate_limited_per_email_even_from_many_ips`.

**Por qué así:** el límite por email es generoso para no trabar a quien se
equivoca de verdad. El costo es que alguien puede bloquear 15 minutos el
login de una cuenta ajena probando 20 veces; con el límite por IP y
Turnstile, ese abuso es caro.

**Queda abierto:** la CSP del frontend con `script-src 'unsafe-inline'`
(pasar a nonces) es un cambio del frontend aparte.
