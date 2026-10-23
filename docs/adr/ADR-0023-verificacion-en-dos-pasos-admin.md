# ADR-0023 — Verificación en dos pasos obligatoria para las cuentas admin

**Estado:** aceptado · **Fecha:** 2026-10-23 · **Complementa a:** ADR-0002 (refresh tokens revocables), ADR-0021 (documentos de identidad privados)

## Contexto

La cuenta admin ve todo: datos de cada persona, el link firmado (5 minutos)
de los DNI y constancias, métricas, tickets, el CV de cualquier trabajador,
el mapa de trabajadores y el "Ver como". Hoy hay una sola, la de Julieta, y
la protege sólo una contraseña (o Google). Con esa contraseña filtrada (un
phishing, un reuso) alguien entra a todo. Trabajadores y comercios no tienen
ese alcance y no cambian.

## Decisión

1. **TOTP (RFC 6238), con app autenticadora.** Código de 6 dígitos, pasos de
   30 s, HMAC-SHA1: lo que usan Google Authenticator, Microsoft
   Authenticator y 1Password. Se acepta el paso actual y uno para cada lado
   (±30 s de desfasaje). **Anti-replay:** se guarda el último paso aceptado
   (`user_two_factor.last_used_step`) y un código de ese paso o anterior no
   vuelve a servir; el guardado es un `UPDATE … WHERE last_used_step < paso`,
   así dos pedidos a la vez con el mismo código no pasan los dos. Sin SMS ni
   mail: son interceptables y cuestan.
2. **TOTP propio, sin `pyotp`.** Son veinte líneas sobre `hmac`/`hashlib`
   (`identity/domain/two_factor.py`), puras y en el dominio, verificadas con
   los vectores oficiales de RFC 4226 y RFC 6238
   (`tests/test_dos_pasos_dominio.py`). `pyotp` es chica y estándar, pero
   sumaba una dependencia más a auditar (pip-audit, Dependabot) para algo que
   el estándar define completo y que no cambia.
3. **El secreto, cifrado en reposo con Fernet** (`cryptography`, que ya
   venía por `pywebpush`; ahora pineada) y la clave en la env var nueva
   `TWO_FACTOR_ENCRYPTION_KEY`. Admite varias claves separadas por coma
   (`MultiFernet`): la primera cifra, todas descifran, para rotarla sin dejar
   a nadie afuera. El cifrado es un puerto (`SecretCipher`) con el adaptador
   en `infrastructure/`.
4. **Códigos de recuperación:** 10, de un solo uso, `xxxx-xxxx-xxxx` sin
   caracteres confundibles (~59 bits cada uno). Se muestran **una vez** al
   activar; en la base sólo su sha256 (son al azar, no contraseñas elegidas,
   igual que los tokens de recuperación de contraseña). Gastar uno es un
   `UPDATE … WHERE used_at IS NULL`.
5. **Login en dos pasos con desafío.** Si la cuenta es admin y tiene la
   verificación activa, `POST /auth/login` y `POST /auth/google` no dan
   sesión ni cookie: devuelven `{two_factor_required, challenge_token,
   expires_in}`. La sesión sale de `POST /auth/2fa/verify` con el desafío y
   un código (de la app o de recuperación). El desafío vence a los 5 minutos,
   sirve una vez, se quema a los 5 errores y se guarda sólo su sha256
   (`two_factor_challenges`). Además del límite por IP (10/min, como el
   login) hay un tope por cuenta en la base: 10 errores en 15 minutos traban
   el paso del código, sin importar desde cuántas IPs.
6. **La sesión verificada es un claim.** Los tokens que emite el paso del
   código (o la activación) llevan `mfa: true`, en el access y en el
   refresh, así sobrevive a la rotación (ADR-0002). Una sesión de antes de
   activar la verificación no se vuelve verificada sola.
7. **Obligatoria, con el candado en la dependencia de autenticación.**
   `get_current_user` (la que usa todo endpoint autenticado) responde **403
   con `detail.code`** a una sesión admin que no está verificada:
   `two_factor_setup_required` si no la activó, `two_factor_required` si la
   activó pero esta sesión no pasó por el código. Va en `get_current_user` y
   no sólo en `/admin` porque el rol admin abre cosas en endpoints
   compartidos (tickets ajenos, `cv_url`, `/matching/search`, el WebSocket):
   así un endpoint nuevo queda cubierto solo. Las únicas excepciones usan
   `get_current_user_allow_pending_2fa`: `GET /auth/me` y el alta
   (`GET /auth/2fa`, `POST /auth/2fa/setup`, `POST /auth/2fa/confirm`). En
   cada pedido de un admin se mira además que la verificación siga activa
   (una consulta por clave primaria): si soporte la apaga, los tokens
   verificados dejan de abrir el panel en el acto.
8. **Nadie queda afuera al prenderla.** Un admin sin la verificación entra
   con la contraseña como siempre, pero sólo puede activarla; el frontend
   ve el 403 con `two_factor_setup_required` y lo lleva a
   `/admin/seguridad`. Al confirmar el alta se cierran **todas** las demás
   sesiones de la cuenta (las abiertas antes, en otros dispositivos o de
   alguien con la contraseña, nunca pasaron por un código) y se emite una
   sesión verificada. **Las sesiones abiertas al deployar** quedan en ese
   mismo estado: no se cortan, pero no abren nada de admin hasta activar la
   verificación.
9. **Cambiar de celular y códigos nuevos**, desde `/admin/seguridad`: piden
   una sesión verificada **y** un código actual (de la app o de
   recuperación), así un access token robado no alcanza para cambiarle el
   celular a la cuenta ni para sacar códigos nuevos. El secreto nuevo espera
   en `pending_secret_encrypted` y recién reemplaza al vigente cuando se
   confirma con un código de la app nueva.
10. **Plan B sin endpoint:** `python -m scripts.disable_two_factor --email …`
    (dry-run por defecto, `--apply` para hacerlo) borra el secreto, los
    códigos y los desafíos, y cierra las sesiones. Lo corre quien tiene la
    `DATABASE_URL`. Al volver a entrar, el panel pide activarla de nuevo.
11. **Auditoría en UTC:** `enabled_at`, `used_at` y los logs
    (`2fa.activada`, `2fa.codigo_de_recuperacion_usado`,
    `2fa.cuenta_trabada`, `2fa.desactivada_por_script`) con el `user_id`,
    nunca el email ni el código.

## Consecuencias

- Migración `0044` con las tres tablas. En SQLite (tests) y Postgres igual.
- **Orden del deploy:** cargar `TWO_FACTOR_ENCRYPTION_KEY` en Render antes
  del merge. Sin ella, el alta responde 503 y el panel de admin queda
  cerrado (falla cerrado): no se rompe nada más, y se arregla cargando la
  clave.
- **Perder la clave** deja inservibles los secretos guardados: hay que
  apagar la verificación con el script y volver a activarla. Por eso va en
  el gestor de contraseñas, junto a las demás.
- Ventana de primera vez: hasta que Julieta active la verificación, quien
  tenga su contraseña podría activarla con su propio celular. Se cierra
  activándola apenas se deploya; si pasara, el plan B la recupera.
- El QR se dibuja en el navegador con `uqr` (sin dependencias, ~27 KB, sólo
  en esa pantalla): el secreto no sale a un servicio de terceros.
- Fuera de alcance: passkeys (diseñadas en `reference/ACCESO_MODERNO.md`,
  post-beta) y la verificación para trabajadores y comercios.
