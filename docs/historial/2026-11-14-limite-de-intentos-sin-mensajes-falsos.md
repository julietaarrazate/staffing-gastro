# Límite de intentos sin mensajes falsos (#PRNUM)

**Pedido:** G10 de la salida a beta (U138, U139). Al registrarse desde una conexión que ya había llegado al límite de ingresos, la cuenta se creaba pero la pantalla decía «Demasiados intentos» como si el alta hubiera fallado; en `/recuperar` y `/verificar-email` un 429 se ocultaba o se mostraba como «enlace inválido».

**Qué cambió:**
- Alta con el ingreso automático frenado (cualquier error del `login` que sigue al alta): `register()` de `frontend/lib/auth-context.tsx` devuelve `{ signedIn: false }` y `app/register/page.tsx` manda a `/login?aviso=cuenta-creada` con «Tu cuenta ya está creada: ingresá en un minuto.», sin cartel de error. Se conservan el `next` (viaja en la dirección) y el plan elegido (se guarda antes de salir). Al ingresar con ese aviso, `app/login/page.tsx` sigue por `/bienvenida` (el onboarding que se había salteado). Un 429 del alta misma sigue mostrándose.
- `/recuperar` y `/verificar-email` (confirmar y reenviar): un 429 dice «Demasiados intentos, esperá un minuto.» y el formulario queda para reintentar. Cualquier otro error sigue sin revelar si el mail existe. Helpers `isRateLimited` y `RATE_LIMITED_MESSAGE` en `lib/api.ts`; aviso nuevo `cuenta-creada` en `lib/safe-next.ts`.
- Tests: `e2e/limite-de-intentos.spec.ts` con la forma real del 429 de `backend/app/core/rate_limit.py` (`{"detail": "Demasiados intentos. Esperá un momento y volvé a probar."}`), y unit tests del aviso en `lib/safe-next.test.ts`.

**Por qué así:** el aviso viaja como una palabra y el texto lo pone la app (criterio de `LOGIN_NOTICES`). El mensaje fijo del 429 en recuperar/verificar no revela nada: el límite es por conexión, no por mail.

**Queda abierto:** nada.
