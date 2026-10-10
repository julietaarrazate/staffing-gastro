# Autenticación: Google sobre una cuenta sin verificar, y ADMIN_EMAILS

**Pedido:** ajustes de autenticación de la auditoría del 2026-10-10 (ver
[`2026-10-10-auditoria-privacidad.md`](./2026-10-10-auditoria-privacidad.md)).

**Qué cambió:**

- **Entrar con Google a una cuenta que nunca confirmó el email.** Alguien
  podía registrarse con contraseña usando un email ajeno (sin confirmarlo:
  el login no lo exige). Cuando la dueña real entraba con Google, compartían
  la cuenta: el otro seguía entrando con su contraseña y veía lo que ella
  cargaba (DNI y selfie, chats, perfil). Ahora, si la cuenta existente no
  está verificada, Google —que sí prueba el email— se la queda: se marca
  verificada, la contraseña anterior deja de servir y se revocan todas las
  sesiones. `IdentityService._claim_unverified_account`
  (`backend/app/modules/identity/application/services.py`). Si era la misma
  persona, recupera la contraseña con "Olvidé mi contraseña".
- **`ADMIN_EMAILS` sólo promueve cuentas verificadas**
  (`backend/app/modules/admin/bootstrap.py`). Antes, si se agregaba a la
  lista un email que todavía no tenía cuenta, cualquiera podía registrarlo y
  el próximo reinicio lo hacía admin. No le quita el rol a quien ya lo tiene.

**Tests:** `test_google_auth.py` (dos casos nuevos) y
`test_admin_bootstrap.py` (nuevo); el de cada agujero falla sin el arreglo.

**Por qué así:** se descartó bloquear el login de cuentas sin verificar
(rompería a quien se registró y todavía no abrió el mail). Quedarse con la
cuenta al probar el email es lo que hacen los servicios grandes ante este
caso.

**Queda abierto — rate limit detrás del proxy de Render.** `RateLimiter`
usa `request.client.host`, y uvicorn arranca sin `--proxy-headers`, así que
todos los pedidos llegan con la IP del proxy de Render: el límite de login
(10/min) es en la práctica global, y alguien puede dejar a todos con 429. El
arreglo depende de qué header trae la IP real **sin que el cliente pueda
falsearlo**, y eso no está documentado por Render: un empleado dijo en su
foro que la primera IP de `X-Forwarded-For` es la real, pero el cliente
puede mandar ese header, y no está confirmado si `CF-Connecting-IP` /
`True-Client-IP` llegan. Elegir mal convierte un límite global en uno que se
esquiva cambiando un header. Antes de tocarlo: mirar en los logs de Render
las líneas `login fallido ... ip=` (si son todas IPs internas, se confirma
el diagnóstico) y verificar qué headers llegan.
