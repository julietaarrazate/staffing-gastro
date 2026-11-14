# Tarjetas que se salen de la pantalla con un nombre largo (G24: U026, U075, U124) (#566)

**Pedido:** Julieta, salida a beta (G24). En celular, con un nombre largo, la
tarjeta se salía de la pantalla y el botón quedaba afuera. Más un ajuste del
sello «Identidad verificada» en la lista de postulantes: por debajo de 390 px
quedaba un escudo solo, que no se entiende sin texto, y 360 px es el ancho más
común en Android.

**Qué cambió:**
- Lo que ve el usuario: con un nombre de 60 letras, a 390, 360 y 320 px, la
  página ya no tiene scroll horizontal y ninguna tarjeta se sale. Se arregló
  en «Recomendados» (la tarjeta medía 691 px y «Asignar» quedaba afuera), en
  la lista de chats (957 px), en «Turnos en vivo» de admin (985 px) y en la
  lista de soporte de admin (1.086 px). En «Turnos en vivo», a 320 px, el
  selector «Todos / Urgentes / Escalados» tampoco entraba y empujaba la
  página: ahora se desliza dentro de su pista, como ya hacen otras pantallas.
- Sello en postulantes: desde 390 px el chip entero «Identidad verificada»;
  de 360 a 389 px el escudo con «Verificada»; por debajo de 360 px el escudo
  solo. A 360 px «Verificada» ocupa 93 px y deja 42 px libres antes de
  «Asignar». El nombre accesible es siempre «Identidad verificada» y en cada
  ancho hay un solo sello en el árbol de accesibilidad.
- Técnico: la causa era una grilla (`grid`) sin `grid-cols-1`, que toma el
  ancho mínimo de su contenido. Se agregó `grid-cols-1` y `min-w-0` en
  `frontend/app/shifts/[id]/candidates/page.tsx`,
  `frontend/components/CandidateCard.tsx`, `frontend/app/chats/layout.tsx`,
  `frontend/app/admin/en-vivo/page.tsx` y `frontend/app/admin/support/page.tsx`.
  `frontend/components/IdentityVerifiedBadge.tsx` cambia la prop `compact` por
  `responsive` (tres variantes que se alternan con CSS, sin `!important`) y
  `frontend/components/ui/Badge.tsx` suma `dense` (menos relleno).
- Pruebas: `frontend/e2e/tarjetas-angostas.spec.ts` (nombre de 60 letras a 390,
  360 y 320 px en postulantes, recomendados, chats y las dos de admin) y el
  caso del sello en `frontend/e2e/sellos-de-confianza.spec.ts` (390, 389, 360,
  359 y 320 px).

**Por qué así:** `grid-cols-1` en vez de depender sólo de `min-w-0` en el hijo,
porque la columna implícita de la grilla es `auto` y crece igual. El sello se
alterna con `display: none` (no con `aria-hidden`) para que el árbol de
accesibilidad tenga uno solo. Se usaron sólo variantes `min-[...]`: el
`max-[389px]` de Tailwind 4 queda exclusivo y dejaba afuera los 389 px. No se
tocó `SegmentedControl` (lo usan nueve pantallas): el arreglo del selector de
«Turnos en vivo» es local.

**Queda abierto:** «Recomendados» (`CandidateCard`) sigue con el chip entero
en todos los anchos: entra en su columna incluso a 320 px.
