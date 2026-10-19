# La pantalla de inicio es el "oído" fileteado (#PR)

**Pedido:** Julieta, 2026-10-19: "saquen el logo que aparece ni bien abrís
la app antes de que entre a la landing, sigue ese genérico; pondría el oído
fileteado porteño grande como un inicio previo a la lectura de la landing, y
el ícono que de momento sólo sea ícono de la app hasta tener el nuevo".

**Qué ve el usuario:** al abrir Oído (una vez por sesión), en vez del fondo
naranja con el isotipo en una tarjeta blanca y "oído" en Fraunces, aparece
el "oído" fileteado grande (el mismo del final de la landing y de la
miniatura) con "Personal gastronómico, ya." debajo, sobre el cielo celeste;
en modo oscuro, sobre la noche azul. Ahora también se ve antes de la landing
para quien entra sin sesión (antes se salteaba ahí). El isotipo queda sólo
como ícono de la app.

**Qué cambió (técnico):** `components/SplashScreen.tsx` usa
`Filete tam="firma"` en lugar de `LogoGlyph` y el wordmark, sin los anillos
pulsantes, y ya no se saltea en `/` sin sesión. Fondo y ámbar del tagline en
`.splash-cielo` / `.splash-ya` (`app/globals.css`), con variante oscura. El
tiempo en pantalla no cambia (mínimo 1,1 s, tope 6 s; con "reducir
movimiento" no anima). `color-system.md` actualizado.

**Por qué así:** la marca es una sola desde el 2026-10-19 (encabezado,
final, miniatura): el filete. La splash naranja era el último lugar donde la
apertura seguía con la identidad anterior.
