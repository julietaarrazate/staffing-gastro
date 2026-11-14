# En compu también se llega al detalle del turno y a Buscar (G18)

**Pedido:** salida a beta, U064 y U104: en escritorio, en Buscar y en el Mapa
no había cómo abrir `/turno/[id]`; uno se postulaba sin leer la descripción. Y
«Buscar» no estaba en el menú del trabajador.

**Qué cambió:** en la grilla del Inicio (md+) y en `/buscar`, tocar la tarjeta
abre el detalle del turno. En `/map` (panel lateral de escritorio) lo hace la
fila del turno. En la barra superior del trabajador aparece «Buscar», entre
«Turnos» y «Mapa». Postularse, guardar, «Cómo llegar», «Compartir» y el link al
comercio siguen haciendo lo suyo, sin navegar.
- `frontend/components/worker/OpportunityCard.tsx`: prop nueva `href`. Con ella,
  un `<Link>` real estirado sobre toda la tarjeta (`absolute inset-0`) con
  `aria-label` «Ver el turno de …»: se llega con Tab, se abre con Enter y tiene
  anillo de foco. Lo interactivo de adentro va con `z-10` por encima. Sin
  `href` (mazo mobile `SwipeDeck`, landing) la tarjeta queda igual que antes.
- `frontend/app/feed/page.tsx`, `frontend/app/buscar/page.tsx`: pasan
  `href={`/turno/${id}`}`.
- `frontend/app/map/page.tsx`: `ShiftRow` (panel de escritorio) pasa de
  `div role="button"` con `onClick` a un link real estirado, igual que la
  tarjeta; ya no abre la hoja. La hoja del mapa en celular no se tocó.
- `frontend/components/Navbar.tsx`: `NavLink` «Buscar» (`/buscar`) del trabajador.
- `frontend/e2e/detalle-en-compu.spec.ts`: 1280 px (clic en la tarjeta, teclado,
  guardar y postularse sin navegar, «Buscar» en el menú, fila del mapa) y 390 px
  (el Inicio sigue siendo el mazo; Buscar abre el detalle).

**Por qué así:** un link estirado y no un `div` con `onClick`: es teclado y
lector de pantalla gratis y respeta clic con botón del medio. Se descartó que el
link envuelva toda la tarjeta (anidaría botones dentro de un `<a>`, HTML
inválido). El link va como hermano del contenido y no en el título porque el
hero es `overflow-hidden` y posicionado, y el `::after` del título sólo cubría
el hero.

**Queda abierto:** nada de G18. G20 (toque vs arrastre del mazo) es otro grupo.
