# "Ingresar" y "Crear cuenta" se marcan al tocarlos y en su pantalla

**Pedido:** Julieta, 2026-10-13. "Si toco Ingresar o Crear cuenta se tiene
que marcar; si pongo Ingresar no se selecciona, queda en blanco."

**Qué cambió:**

- Encabezado de la app sin sesión (`frontend/components/Navbar.tsx`,
  `AuthLink`): el link de la pantalla en la que estás queda marcado en el
  celeste de marca (`bg-secondary text-on-brand`, `aria-current="page"`):
  "Ingresar" en `/login`, "Crear cuenta" en `/register`. El otro va en
  contorno o como texto. Al tocar cualquiera de los dos se hunde y se tiñe.
  Antes "Crear cuenta" iba siempre en ámbar: en `/login` parecía el elegido
  e "Ingresar" quedaba en blanco.
- Encabezado de la landing (`components/landing/LandingHeader.tsx`): los dos
  botones responden al toque igual (celeste y se hunden).
- Test: `e2e/auth.spec.ts` verifica qué link queda marcado en cada pantalla.

**Por qué así:** celeste y no ámbar porque el ámbar de esas pantallas es su
botón principal ("Ingresar" / "Crear cuenta" del formulario), y la regla es
un solo acento ámbar por pantalla. Revisado en 412 px, claro y oscuro.

**Queda abierto:** nada.
