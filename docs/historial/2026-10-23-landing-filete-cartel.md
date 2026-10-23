# Landing: tres momentos animados, mapa real y el «oído» con letra de cartel (#PR)

**Pedido:** Julieta, 2026-10-23, en varias vueltas sobre pruebas publicadas
como links: que siga corta como coofounder pero con mejor nivel de diseño y
los efectos bien puestos; mapa más realista, como en la app; la comanda que
se vuelva a imprimir al volver, más despacio; el filete de «oído» "muy
simple" (referencias de fileteado y de alfabetos "lettres fantaisie"); que
se lea «oído» completo y que el Sol de Mayo esté al final, como el cierre de
coofounder; Términos y Privacidad separados en el pie. "Mergeá como me
pasaste la prueba y después vemos qué ajustamos."

**Qué ve el usuario:**
- Inicio: el cielo llega hasta arriba (el encabezado es transparente hasta
  que bajás); la palabra cambia como un cartel de estación; botones del
  mismo ancho en el celular; botones principales en negro; títulos más chicos.
- Comanda: el campo es como un mensaje de chat en el celular; la frase se
  escribe al ver el campo, la demo aprieta Pedir e imprime al ver el ticket,
  con un golpecito al caer «¡Oído!». Se repite si la sección salió del todo.
- Mapa: imagen real de Palermo con el estilo del mapa de la app; sale una
  onda desde Tu bar, tres se postulan, Lucía se pone ámbar y viene mientras
  bajan metros y minutos; relojito 20:46 → 20:54 ✓; el pie aparece una sola
  vez. En escritorio va en dos columnas, como Para trabajar y Preguntas.
- El «oído» en letra de cartel (Sancreek) crema con filete blanco, relieve
  azul hondo y canto dorado, en el encabezado, la pantalla de inicio (con
  adornos finos dorados) y la cinta de la comanda. Al final, la palabra
  grande cortada por el borde con el Sol de Mayo saliendo detrás.
- Pie: Términos y condiciones y Privacidad.

**Qué cambió (técnico):** `Filete.tsx` reescrito (Sancreek, `Sol`, `Letras`,
`Adornos`, misma API); fuente local `app/fonts/sancreek-oido.woff2` (recorte
de "oídO¡!", 1,5 KB, como el de Fraunces de #499); `LandingFooter.tsx` con el
sol; `MapaCamino.tsx` sobre `public/landing/mapa-palermo.webp` (Carto Voyager
renderizado una vez con MapLibre, crédito © OpenStreetMap · © CARTO en el
mapa); `Comanda.tsx` con dos IntersectionObserver; `HeroRueda.tsx` con el
cartel de estación y la rueda que se frena fuera de pantalla;
`LandingHeader.tsx` transparente arriba; `DISTANCIA_M` en `fixtures.ts`;
tarjetas con radio y sombra comunes (`--l-radio`, `--l-sombra`).

**Pendiente:** Julieta duda de la letra del «oído» y de si el acento sigue
ámbar o pasa a bordó; la miniatura, la ficha y el brand system siguen con el
filete anterior; consultar el uso del Sol de Mayo antes de registrar la
marca (ver `docs/STATUS.md`).
