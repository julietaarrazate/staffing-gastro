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
  pestaña, al enterarse por el evento `storage`, arranca de nuevo desde el
  inicio con la sesión que hay (`lib/restart-at-home.ts`): el inicio la lleva
  a la pantalla de esa cuenta.
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

**Lo que encontró la revisión independiente (arreglado acá):** una pestaña
que todavía se estaba abriendo podía pisar la clave con su cuenta vieja si
otra ingresaba mientras tanto, y la que acababa de ingresar se recargaba sin
motivo. Ahora, si la clave ya es de otra cuenta, la que se recarga es la que
se estaba abriendo (una sola vez por cuenta).

**Lo que encontró la prueba en la app (arreglado acá):** la primera versión
recargaba la pestaña en la misma dirección. Un comercio en su panel y un
trabajador que ingresaba en otra pestaña dejaban la primera en el panel del
comercio con «Permisos insuficientes». Ahora arranca desde el inicio. Y una
pestaña que había quedado sin sesión (por ejemplo, después de «Salir») se
quedaba en la landing con «Ingresar» aunque otra pestaña ya hubiera
ingresado: ahora también arranca con esa sesión.

**Queda abierto:** nada de estos tres detalles.
