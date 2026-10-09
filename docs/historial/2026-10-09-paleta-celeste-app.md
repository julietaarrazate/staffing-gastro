# La paleta celeste pasa de la landing a toda la app

**Pedido:** Julieta, 2026-10-09, en el hilo "Identidad de marca de Oído".
Después del merge de #408 entró a la app y vio que "adentro no cambió nada":
la paleta sólo estaba prendida en la landing, como prueba. Ya había elegido
el 2026-10-08 que sea la paleta de toda la app.

**Qué cambió:**

1. **El bloque de tokens rige en `:root`** (`globals.css`, "PALETA
   CELESTE"), y también en cualquier subárbol forzado a claro. Ya no depende
   de `data-palette`; la landing lo sigue llevando sólo para sus reglas
   propias (tono del foco por tramo, mapa).
2. **Modo oscuro:** toma el ámbar `#ffab25`, el celeste y la noche de la
   paleta, y aclara en su bloque los `-text` (ámbar, celeste `#c4e3ed`,
   `#9ac9e7`), los `-tint` (el color al 14–16%) y el anillo de foco
   (ámbar). Contrastes en
   [`design-system/color-system.md`](../design-system/color-system.md), "v6".
3. **Letra blanca sobre la marca, ahora en tinta** (`on-brand`): la tarjeta
   "Recomendado" del inicio sin foto (`FeedHero`), el encabezado del perfil
   (`WorkerGameCard`), el bloque del pago del detalle del turno, la tarjeta
   "Mejor valorado" de postulantes, y los cuadraditos de rubro del mozo
   (helper nuevo `heroTile()` en `lib/skill-style.tsx`, usado en el mapa,
   Buscar y postulantes).
4. **Letra blanca sobre ámbar, en tinta** (el blanco da 1,89): la splash,
   la inicial de los perfiles de trabajador y comercio sin foto, la de
   `ImageUpload` y el botón de ubicación de Buscar.

**Queda abierto:** el logo sigue en el ámbar `#d97706`; el PDF del design
system y el paquete del diseñador siguen en violeta. Los chips de tono
`manteca`, `secondary` y `primary` quedaron los tres celestes.
