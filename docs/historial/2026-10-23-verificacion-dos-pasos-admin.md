# Verificación en dos pasos obligatoria para la cuenta admin (#508)

**Pedido:** Julieta, vía el coordinador: que la cuenta admin (ve datos de
personas, documentos de identidad y métricas) pida, además de la
contraseña, un código de una app autenticadora. Trabajadores y comercios no
cambian. Decisión completa en
[ADR-0023](../adr/ADR-0023-verificacion-en-dos-pasos-admin.md).

**Qué cambió:**

- **Login de la admin:** después de la contraseña (o de Google), `/login`
  pide el código de 6 dígitos de la app, o uno de recuperación ("No tengo el
  celular"). Si entra con uno de recuperación, le avisa cuántos le quedan y
  le ofrece ir a Seguridad.
- **Administración → Seguridad** (`/admin/seguridad`, también en Ajustes y
  en el menú del panel): el alta (QR, la clave a mano para copiar, el
  código, y los 10 códigos de recuperación con Copiar y Descargar, que se
  muestran una vez), y con la verificación activa: desde cuándo, cuántos
  códigos quedan, "Generar códigos nuevos" y "Cambiar de celular" (los dos
  piden un código actual).
- **Obligatoria:** una admin sin activarla entra igual, pero todo endpoint
  le responde 403 `two_factor_setup_required` salvo `/auth/me` y el alta; el
  frontend la lleva a Seguridad y esconde el menú hasta que termine. Una
  sesión de antes de activarla (otro dispositivo) recibe
  `two_factor_required` y vuelve al login. Las sesiones abiertas al
  deployar quedan así: no se cortan, pero no abren nada de admin.
- **Backend** (`backend/app/modules/identity/`): TOTP propio en
  `domain/two_factor.py` (vectores de RFC 4226/6238 en los tests), casos de
  uso en `application/two_factor.py`, adaptadores en
  `infrastructure/two_factor_repositories.py` y
  `infrastructure/fernet_secret_cipher.py`, el candado en
  `api/dependencies.py` (`get_current_user` vs
  `get_current_user_allow_pending_2fa`), endpoints `/auth/2fa/*` en
  `api/routes.py`. Claim `mfa` en access y refresh. Migración `0044` (tres
  tablas). Env var nueva `TWO_FACTOR_ENCRYPTION_KEY` (`config.py`,
  `render.yaml`). Plan B: `backend/scripts/disable_two_factor.py`.
- **Frontend:** `lib/two-factor.ts`, el 403 con `detail.code` en
  `lib/api.ts` (`ApiError.code`, `setTwoFactorGateHandler`), el desafío y la
  adopción de la sesión en `lib/auth-context.tsx`,
  `components/TwoFactorLoginStep.tsx`, `components/admin/TotpQr.tsx` (QR con
  `uqr@0.1.3`, sin dependencias) y `components/admin/RecoveryCodesPanel.tsx`.
- **Tests:** `tests/test_dos_pasos_dominio.py` y `tests/test_dos_pasos_admin.py`;
  los `_make_admin` de los tests de admin ahora activan la verificación por
  la API (`make_admin` en `tests/conftest.py`). E2E en
  `frontend/e2e/admin-dos-pasos.spec.ts`.

**Por qué así:**

- **El candado en `get_current_user` y no sólo en `/admin`:** el rol admin
  también abre cosas en endpoints compartidos (tickets ajenos, el CV, el
  mapa de trabajadores, el WebSocket). Con el candado en la dependencia, un
  endpoint nuevo queda cubierto sin acordarse.
- **Entrar sin la verificación para poder activarla**, en vez de bloquear el
  login: si no, el día del deploy Julieta quedaba afuera.
- **TOTP propio en vez de `pyotp`:** veinte líneas con vectores oficiales,
  una dependencia menos. El QR en el navegador para que el secreto no pase
  por un servicio de terceros.
- **Descartado:** SMS o mail como segundo factor (interceptables, cuestan),
  y desactivar la verificación desde la app (con un token robado se
  apagaba; el plan B es un script con acceso a la base).

**Queda abierto:**

- Julieta: cargar `TWO_FACTOR_ENCRYPTION_KEY` antes del merge y activar la
  verificación apenas se deploya (en `../STATUS.md`, "Pendiente de
  Julieta").
- Nada más del lado del código. La migración `0044` va sobre la `0043`
  (cola de borrado de evidencias, #507, que se mergeó antes).
