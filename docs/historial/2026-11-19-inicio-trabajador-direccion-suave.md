# El Inicio de quien trabaja con la dirección suave, y el cielo cuando no hay foto (#696)

**Pedido:** Julieta, 2026-11-19, después de ver la prueba de identidad por
pantalla: «dale, arranquemos con el Inicio de quien trabaja». Mientras se
hacía sumó: «lo que no me copa es ese marrón cuando no cargan la foto;
debería ir algo estético en su lugar».

**Qué cambió:** el Inicio (`/feed`), sólo la piel. Qué se pide, cómo se
ordena y qué pasa al tocar cada cosa quedó igual.

- **Arriba, el cielo nuevo:** un celeste más vivo con una nube con volumen
  que asoma a la derecha y otra chica «de lejos». De noche no hay nubes:
  quedan unas pocas estrellas, a la derecha del título.
- **El título es «Hay turno a la vuelta»**, grande y en letra normal; el
  saludo va arriba, chico. Se fueron la brocha y la letra a mano.
- **«Disponible» es un chip de vidrio** con un punto verde o gris (antes, el
  cartelito colgado). Funciona igual.
- **El buscador sigue**, como campo de vidrio sobre el cielo.
- **El turno recomendado es una tarjeta**: la foto arriba con los avisos
  («Urgente», «Para hoy» y la distancia, que es nueva en esta pieza) y abajo
  el puesto con el pago grande.
- **«Cerca tuyo» son filas suaves**: el puesto; el local (lo único que se
  acorta) con la distancia; y el horario en su renglón, que nunca se corta.
- **Sin foto, la portada es el cielo** con una nube y el ícono del rubro en
  un círculo de vidrio (de noche, el azul hondo). Reemplaza al bloque marrón
  en la tarjeta del Inicio, en las filas y en `OpportunityCard`, así que
  también cambia en «Descubrir rápido», en `/buscar` y en `/historia`.

Técnico: `app/feed/page.tsx`, `components/worker/FeedHero.tsx`,
`NearbyRow.tsx`, `OpportunityCard.tsx`, `components/AIAssistantBar.tsx`
(prop `vidrio`), `components/PerfilFaltanteCard.tsx`. Piezas nuevas:
`components/ui/NubesCielo.tsx`, `components/ui/PortadaCielo.tsx` y
`scripts/build-nubes.mjs`, que escribe `public/cielo/nube-{a,b,c}.webp`
(unos 10 KB cada una). En `globals.css`: el cielo nuevo para toda la app
(`--app-cielo-*`, `--app-cielo-luz`), `.cielo-limpio`, `.campo-vidrio`,
`.chip-foto`, `.portada-*` y los tamaños `--text-titular`, `--text-puesto`,
`--text-pago` y `--text-fila`. Se borró `.cartelito`.

**Por qué así:**

- **Piel primero, función después.** La maqueta abre con «Hoy trabajás a las
  20:00», pero el Inicio de hoy no muestra el turno asignado: eso es una
  función nueva y va en su propio paso. Por lo mismo no se agregó
  «Postularme» a la tarjeta (hoy abre el detalle) ni se sacó el buscador.
- **Las nubes son imágenes, no filtros:** las dibuja un script propio (mapa
  de altura y luz), pesan poco y no cargan a los celulares modestos.
- **El marrón no se cambia de un solo lugar:** sale de `SKILL_HERO_TONE`
  (`lib/skill-style.tsx`) y cada pantalla le escribe encima en blanco. Se
  reemplazó pieza por pieza, donde ya se estaba trabajando.
- **El horario manda sobre el nombre del local.** La primera versión juntaba
  local, distancia y horario en un renglón que se cortaba; la revisión lo
  marcó como regresión.

**Revisión independiente** (otro agente, intentando romperlo: de 320 a
1280 px, en claro y oscuro, con teclado, texto al 200 %, «reducir
movimiento», y los estados cargando, vacío, error y nombres largos; también
`/buscar`, Publicar turno, la bienvenida y el panel con el cielo nuevo).
Aprobó con detalles, y se arreglaron: el horario cortado en «Cerca tuyo», el
desborde con texto al 200 % a 320 px, las estrellas y la nube sobre el
título en pantallas chicas, el contraste del chip «Disponible» sobre la
nube, su nombre accesible (ahora empieza con lo que se ve), el `h1` que se
leía «turnoa» y el esqueleto de carga, que no se veía de noche. Una segunda
pasada sobre esos arreglos encontró una regresión del propio arreglo (la
regla del esqueleto le pisaba el rojo al botón del micrófono de «Publicar
turno»; ahora apunta sólo a `[data-skeleton]`) y un puesto de una palabra
larga que desbordaba con el texto al 200 %. Y la primera corrida de CI falló
en un test nuestro: a 320 px, con un pago largo, al horario le sobraban
0,3 px; se arregló el diseño (el horario cruza todo el ancho de la fila,
también debajo del pago), no la medición.

**Queda abierto** (detalle en `design-system/direccion-relieve.md`, «En el
código»): la hora gigante del turno de hoy; el marrón en `ShiftCard`,
`ShiftDetail`, el mapa y Buscar del comercio; la grilla de escritorio, que
sigue con la letra y los botones de antes; el cielo nuevo en la landing; y
lo que venía de antes y vio la revisión (toques de menos de 44 px en el
encabezado y en «Estoy acá» / «Ver todos», la barra de abajo con texto al
200 %). No se probó en un celular táctil real ni la tarjeta sin foto dentro
de `/historia`.
