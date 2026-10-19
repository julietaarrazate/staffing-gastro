# La paleta de la landing pasa de violeta a celeste claro

**Pedido:** Julieta, 2026-10-09, en el hilo "Identidad de marca de Oído".
Quería cambiar el violeta por otro color "sin rehacer todo". Mandó una
referencia (un sitio de pasta con paneles celestes y letra naranja), eligió
el celeste claro y descartó el petróleo. Se probó primero el celeste como
lienzo con botones naranja `#e64c1e`; comparándolo con la versión que se le
había mandado al diseñador, decidió: **el celeste claro va donde estaba el
violeta, y el resto queda como lo dejó el diseñador** (ámbar `#ffab25` con
tinta, lienzo `#f3f3f3`). La versión naranja quedó descartada.

**Qué cambió:**

1. **El bloque de tokens** pasa a llamarse `[data-palette="celeste"]`
   (`globals.css`, prendido por `LandingStory.tsx`). Lo que era violeta es
   celeste claro `#c4e3ed` (superficie de marca, liso: `--gradient-brand:
   none`) y azul hondo `#1c5478`, el mismo tono oscurecido, para el texto
   destacado y el anillo de foco. Recesado y mapa en `#e5eef1`, bordes y
   tintes en `#deecf0`. Lienzo, ámbar, noche y grises, como en la versión
   violeta. Tabla y contrastes:
   [`design-system/color-system.md`](../design-system/color-system.md),
   "Propuesta v6".
2. **Tokens nuevos para la letra sobre la marca:** `on-brand`,
   `on-brand-label`, `on-brand-icon` y `brand-veil`. El celeste es claro, así
   que la letra que iba en blanco sobre el violeta (banner del mozo,
   "Recomendado", reloj cubierto, resultado, encabezado y franja sobre el
   resultado, "Recomendado" de precios) va en tinta. Con la paleta de
   siempre (verde bosque) esos tokens siguen dando blanco y manteca: la app
   no cambia. El banner del mozo decide la tinta con `heroInk()`
   (`lib/skill-style.tsx`): sin foto y sobre la marca, `on-brand`; con foto,
   blanco.
3. **El resultado ya entra celeste**, sin el fundido desde la noche
   (`Resultado.tsx`): con la letra en tinta, sobre la noche no se leería.

**Medido:** contraste de todos los textos visibles de la landing a 390×844,
animada y con "reducir movimiento". Tinta sobre el celeste 13,99; azul hondo
sobre el celeste 6,01, sobre `#f3f3f3` 7,31; tinta al 60% (borde del
secundario) 4,46. Lo único bajo el piso son los grises chicos de las
tarjetas que ya estaban así con v5.0 (ver la entrada del 2026-10-08). La
landing sigue sin oscurecerse con el tema oscuro (fija `data-theme="light"`,
lo prueba `e2e/landing.spec.ts`).

**Queda abierto:**

- El botón ámbar sobre el celeste se separa poco del fondo (1,40:1); su
  letra sí se lee (9,98). Julieta eligió quedarse con el ámbar.
- El logo sigue en el ámbar `#d97706`.
- El PDF del design system, el paquete para el diseñador y la
  previsualización (`/mnt/project-files/design-system/`) siguen en violeta:
  no se rehicieron, por pedido de ahorrar trabajo.
