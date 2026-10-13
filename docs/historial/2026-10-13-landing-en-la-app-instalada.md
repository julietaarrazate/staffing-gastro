# La app instalada sin sesión vuelve a mostrar la landing

**Pedido:** Julieta, 2026-10-13. "Cuando salís de tu cuenta en la app no
podés ver la landing; una persona que instala no puede leer, y antes sí."

**Qué cambió:**

- Abierta desde el ícono instalado y sin sesión, "/" muestra la landing (con
  "Ingresar" y "Crear cuenta" en el encabezado) en vez de mandar a "/login".
  `frontend/components/landing/LandingGate.tsx`.
- "Cerrar sesión" lleva a la landing ("/") en vez de a "/login".
  `frontend/lib/auth-context.tsx` (`logout`).
- Para que la pantalla que se estaba viendo no le gane a esa salida, el
  contexto expone `justLoggedOut` (true desde "Cerrar sesión" hasta el
  próximo ingreso) y `useRequireAuth` manda a "/" en ese caso; si no, sigue
  mandando a "/login" como siempre (`frontend/lib/use-require-auth.ts`).
- Tests: `e2e/landing.spec.ts` (instalada y sin sesión: se queda en la
  landing con Ingresar y Crear cuenta) y `e2e/auth.spec.ts` (cerrar sesión
  termina en "/").

**Por qué así:** la redirección a "/login" para la app instalada entró con la
landing corta (#426), pensando que quien instaló ya eligió Oído. Pero quien
instala antes de registrarse, o sale de su cuenta, se quedaba sin forma de
leer qué es Oído: en Android, con la app instalada, Chrome abre el link
adentro de la app. "Ingresar" queda a un toque, en el encabezado de la
landing.

**Queda abierto:** nada.
