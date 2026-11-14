# Sesión: tres detalles que habían quedado anotados (#PR)

**Pedido:** Julieta, 2026-11-14: arreglar lo que la revisión de #559 (G7)
había dejado anotado en el tablero sin arreglar.

**Qué cambió:**

- **El ingreso ya no muestra el texto que venga en la dirección.**
  `/login?message=…` mostraba cualquier cosa que alguien pusiera en un link
  («Tu cuenta fue bloqueada, llamá al…»). Ahora viaja una palabra
  (`?aviso=clave-actualizada`, `?aviso=codigo-requerido`) y el texto lo pone
  la app: `LOGIN_NOTICES` en `frontend/lib/safe-next.ts`. Lo usan
  `app/restablecer/page.tsx` y el candado de dos pasos de
  `lib/auth-context.tsx`.
- **Otra pestaña que ingresa con otra cuenta.** La cookie de renovación es
  una sola para todo el navegador: la pestaña que seguía mostrando la cuenta
  anterior iba a renovar con la ajena. Ahora la sesión deja dicho de qué
  cuenta es (`staffya_session_user`, el id, que no es un secreto) y la otra
  pestaña, al enterarse por el evento `storage`, se recarga y arranca con la
  sesión que hay (`lib/reload-page.ts`).
- **Alta de la verificación en dos pasos.** El pedido que confirma el alta
  sale después de la renovación que estuviera en vuelo
  (`adoptSession(() => twoFactorApi.confirm(…))`, `app/admin/seguridad/page.tsx`):
  antes, si coincidían, la admin tenía que ingresar de nuevo.

**Por qué así:**

- Recargar la pestaña en vez de cambiarle la cuenta en caliente: no queda
  nada de la cuenta anterior en memoria (listas, formularios a medio
  escribir, caché de pantallas).
- El alta no pasa por `signIn` (que frena las renovaciones mientras dura):
  ese pedido lleva el token de la sesión y, si venció, necesita renovarlo.
  Alcanza con esperar a la renovación en vuelo antes de mandarlo.

**Queda abierto:** una pestaña **sin** sesión no se entera sola de que otra
ingresó (sigue mostrando el ingreso o la landing hasta que se navega o se
recarga).
