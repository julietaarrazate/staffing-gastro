# Precios: un botón por plan que llega hasta "Mi plan" (#PR)

**Pedido:** Julieta (2026-10-30): las tres tarjetas de precios de la landing
(Inicial, Básico, Pro) no tenían acción. Quiere "Empezar con Inicial",
"Empezar con Básico" y "Empezar con Pro", y que el plan elegido llegue a
"Mi plan". Cambia lo decidido el 2026-10-18 (`2026-10-18-landing-cielo`,
punto 5: "sin botones por plan").

**Qué cambió:**

- **Landing** (`frontend/components/landing/Precios.tsx`): cada tarjeta
  termina con su botón, a lo ancho y abajo de todo (`mt-auto`, las tres a
  la misma altura). El Básico, la destacada, con el principal en tinta
  (`landing-btn-primario`); Inicial y Pro con borde (`landing-btn-borde`).
  Sin ámbar. Lleva a `/register?rol=comercio&plan=<code>`. Se actualizó el
  comentario del archivo, que decía "sin botones propios".
- **Plan elegido** (`frontend/lib/plan-elegido.ts`, nuevo): valida el código
  contra los conocidos (`inicial`, `basico`, `pro`; un test los compara con
  `planes.ts`), y lo guarda en `sessionStorage` con try/catch.
- **Alta** (`app/register/page.tsx`): lee `?plan=`, y si la cuenta nueva es
  de comercio lo guarda: con email y contraseña, y con "Continuar con
  Google" si la cuenta es nueva (`GoogleAuthButton` ahora pasa el rol
  elegido en `onDone(true, rol)`). Un código desconocido se ignora.
- **Bienvenida** (`app/bienvenida/page.tsx`): las tres salidas del onboarding
  del comercio ("Terminar", "Cargar después", "Omitir por ahora") van a
  `/subscription?plan=<code>` si hay plan guardado, y lo borran. Si no, a
  `/shifts` como siempre.
- **Mi plan** (`app/subscription/page.tsx`): con `?plan=<code>` válido, la
  tarjeta de ese plan queda con un borde azul hondo (celeste en oscuro, el
  color del foco) y recibe el foco, sin mover la pantalla. Arriba,
  `components/subscription/PlanElegidoAviso.tsx`: "Elegiste el plan Básico",
  precio y tope, y el botón "Activar este plan" (cobro apagado) o "Pagar con
  Mercado Pago" (cobro prendido). Es la misma acción de las tarjetas (abre
  la misma confirmación; no hay flujo de pago nuevo). Si ya es su plan, dice
  "Ya es tu plan" (y, con el cobro prendido y sin pagar, ofrece pagarlo).
  Sin `plan`, o con uno inválido, la pantalla es la de antes.

**Por qué así:**

- **Siempre al alta, aunque haya sesión.** Con sesión la landing no se
  muestra (`LandingGate` manda a la home del rol), así que el botón no tiene
  un caso "con sesión" que resolver. Quien ya tiene sesión, sea de
  trabajador o de comercio, y abre el link a mano ve el alta como cualquiera:
  si crea una cuenta de comercio sigue el mismo recorrido; no se rompe nada.
- **`sessionStorage`**: el plan vale para esta pestaña y este alta. Si se
  cierra, termina en el panel como cualquier alta.
- **Un solo ámbar en Mi plan:** mientras el aviso tiene botón, es el único en
  ámbar: "Mejorá tu plan" de las tarjetas pasa a botón sin acento
  (`PlanCard` `sinAcento`), y el "Pagar el mes" del estado del plan se
  esconde, porque pagaría el plan actual y no el elegido.
- **Foco sin scroll:** en el celular la tarjeta está más abajo; si el foco
  bajaba la pantalla, se perdía de vista el aviso con la acción.

**Tests:** unit `lib/plan-elegido.test.ts` (validación, guardado, sin
almacenamiento). E2E `e2e/plan-elegido.spec.ts`: landing → alta → bienvenida
→ Mi plan con Básico resaltado y activado; botones alineados y sin ámbar;
plan inválido; cobro prendido. `e2e/landing.spec.ts` ahora verifica los
`href` de los tres botones.

**Queda abierto:** con Google y una cuenta que ya existía, el plan no se
guarda (va a la home como antes; el botón de Google no sabe el rol de una
cuenta existente).
