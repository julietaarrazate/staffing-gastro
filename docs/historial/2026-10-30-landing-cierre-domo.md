# Landing: el final con un domo de cielo, como el de coofounder

**Pedido:** Julieta, 2026-10-30, comparando el final de la landing con el de
coofounder: "es abismal lo mal que se ve oído al lado de coofounder, el mío
no tiene el degradado".

**Qué cambió:** el final de la landing (`/`, sin sesión).

- El cielo ya no es una franja: es un domo que sube desde el borde de abajo,
  celeste hondo al centro y cada vez más claro hacia arriba y los costados,
  hasta el blanco. Los links y la firma quedan arriba, sobre blanco.
- Se fue el rectángulo más claro que se veía detrás del sol: el brillo era
  más grande que el dibujo y el borde lo recortaba. Ahora es más chico y se
  apaga antes del borde.
- El «oído» grande va sin la sombra beige y con menos relieve, que a ese
  tamaño lo volvían pesado. Es un poco más grande y queda cortado por el
  borde, como la palabra de coofounder.

Técnico: `frontend/components/landing/LandingFooter.tsx` (brillo `r=170`
centrado en el sol, `Letras` con `e={1.3}` y `sombra={false}`),
`Filete.tsx` (`Letras` suma `sombra`, por defecto `true`: el encabezado y
la comanda no cambian) y `app/globals.css` (`.landing-firma` con
`radial-gradient(120% 100% at 50% 100%, …)` sobre los tokens del cielo;
`.landing-pie-fila` sobre `--color-card`). `docs/design-system/marca-hoy.md`
lo describe.

**Por qué así:** el degradado lineal empezaba de golpe debajo de los links
(blanco a celeste en unos 60 px) y después quedaba plano. Un radial centrado
abajo da la forma de domo sin una franja visible. Se mantiene el filete (es
la marca), pero más limpio a ese tamaño.

**Queda abierto:** nada.
