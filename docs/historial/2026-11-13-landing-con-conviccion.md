# Landing «con convicción»: misma estructura, color decidido y más movimiento

**Pedido:** Julieta, 2026-11-13. Mandó una referencia (un inicio con cielo
pleno, tarjetas flotando y un mosaico) porque la landing "quedó con poco
criterio": el fileteado por un lado y el resto de la página por otro, sin
coherencia de estilos. Sobre una primera propuesta que cambiaba la
estructura respondió que la original "se entiende más, es menos redundante,
no tiene subtítulos que explican lo que ya hace", y que lo que hacía falta
era "convicción de colores, mejores elecciones, más profesional y atractivo"
y "mejorar los efectos, los motion graphic: llamativa pero clara". Vio la
segunda propuesta (misma estructura) y dijo "mergeala, y lo que no me guste
lo ajustamos después".

**Qué cambió:** la estructura, los títulos y los textos son los mismos. No
se agregó ninguna sección, subtítulo ni rótulo.

- **Tres superficies con borde claro, en paneles con margen y esquinas
  redondas**, en lugar de degradés celestes que iban y volvían del blanco en
  casi todas las secciones: cielo pleno para abrir y cerrar, celeste plano
  para el panel de la comanda y el plan del medio, y la noche azul de la app
  para «Turnos cerca tuyo». El resto, blanco. Variables `--l-*` en
  `globals.css`.
- **Inicio:** el cielo deja de lavarse hacia el blanco; nubes dibujadas (un
  banco quieto abajo y dos cirros que derivan muy despacio, `Nubes` en
  `HeroRueda.tsx`); las fichas de abajo se pierden entre las nubes antes de
  quedar de cabeza; las fotos van casi a color (antes, muy apagadas, sobre
  el cielo pleno se veían grises); la palabra que cambia cruza con
  desenfoque en vez de saltar una línea, y va en el ámbar de texto
  (`#B45309`), que es el que se lee sobre este cielo.
- **La marca en el encabezado** va con la misma letra del «oído» pero plana
  y en azul hondo (`.landing-marca`). El fileteado completo, con el Sol de
  Mayo, queda una sola vez, al cierre.
- **Títulos** más grandes y con el interletrado más apretado. **Botones** un
  poco más altos, con sombra y un movimiento corto de la flecha al pasar.
- **Mapa** en celeste: la imagen base es beige y era lo único cálido de la
  página; se pasa a gris y se multiplica contra el celeste. La persona
  elegida y la línea van en azul hondo (antes ámbar): el ámbar queda sólo en
  la palabra del inicio.
- **Precios:** el plan del medio va en el celeste plano con borde tinta; los
  cuadraditos de turnos, todos en tinta.
- **Para trabajar:** panel de noche azul, título y botón claros, y la
  tarjeta del turno flota apenas.
- **Preguntas:** un botón redondo con «+» que gira al abrir.
- **Cierre:** «¿Te falta alguien hoy?» y la palabra grande forman un solo
  panel de cielo; los links y el © pasan debajo, sobre blanco. Los rayos del
  sol giran muy despacio (`claseRayos` en `Sol`, `Filete.tsx`): el disco y
  su relieve no giran.

**Qué se probó:** `npx tsc --noEmit` sin errores; `npm run lint` 0 errores;
`npm run test:unit` 271 passed; `npm run build` ok; Playwright completo, 217
passed. Se miró renderizada a 1440 y a 390 px, con las animaciones
corriendo. La landing es siempre clara (`data-theme="light"`), así que no
hay versión oscura que mirar. Con «reducir movimiento» las nubes, la
tarjeta, el sol y la entrada del título quedan quietos.

**Por qué así:** la landing real ya tenía casi todo el movimiento del
producto (la comanda que se imprime, el mapa que avisa y elige, las barras
de precios), así que el cambio es sobre todo de color, letra y terminación,
con el menor cambio posible en los componentes. Los colores nuevos son
variables de la landing y no tokens de la app, porque no se usan fuera de
ella. La tarjeta de precios conserva su margen interno: lo mide un test.

Un efecto de la propuesta no se construyó: que cada parte de la frase se
resalte mientras llena su renglón de la comanda. En la página real ese
campo es una caja de texto donde el visitante escribe su propio pedido, y
una caja de texto no puede resaltar partes.

**Queda abierto:**
- Las fotos siguen siendo de banco (ya figuraba como pendiente de la marca).
- La variante `marca` de `Filete.tsx` quedó sin uso.
- No se midió el rendimiento en un celular real: las nubes usan un filtro
  de ruido, que se dibuja una vez, pero conviene mirarlo en un equipo
  modesto.
- Julieta va a pedir ajustes sobre lo ya publicado.
