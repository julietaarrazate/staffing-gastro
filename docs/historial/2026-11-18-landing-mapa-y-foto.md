# Landing: el mapa de la prueba y la foto de los bartenders (beta, etapa 4)

**Pedido:** Julieta, 2026-11-18, al ver la landing híbrida publicada (#634):
«no están todos los cambios de la landing, sigue el mismo mapa de la anterior,
y abajo no está la foto que pusiste con los bartenders en "Turnos cerca
tuyo"».

**Qué cambió:** dos piezas de la landing que en #634 habían quedado como
antes, y que en la prueba híbrida eran distintas.

- **El mapa de «Alguien libre, a pocas cuadras».** Es más celeste, y las tres
  personas que se postulan son fotos en un círculo, no círculos con
  iniciales; la que va lleva un aro azul hondo y su línea punteada hasta
  «Tu bar». El pie es una ficha con su foto, «Lucía, moza» y «Va en camino a
  Tu bar · a 190 m». Se fueron del pie la estrella con el puntaje y el sello
  «Identidad verificada». La secuencia (la onda, los puntos, los tres que se
  postulan, la que viene) es la misma.
- **«Turnos cerca tuyo».** La oferta lleva la foto de los bartenders en la
  barra, y el puesto dice «Bartender» (antes la bandeja y «Mozo/a»).

Técnico: `frontend/components/landing/MapaCamino.tsx` (`POSTULANTES` con
`foto`, `cara` y `zoom`), `ParaTrabajar.tsx`, y en `globals.css` el tinte del
mapa (`.landing-mapa-calles::before` en modo «color» más un velo) y
`.landing-mapa-cara`. Test de la ficha en `e2e/landing.spec.ts`.

**Por qué así:** en #634 se leyó «el mapa va en celeste, sin reloj» como
«sacarle el reloj al mapa que hay», y la oferta se dejó con su foto. Julieta
comparaba contra la prueba, que es lo que había aprobado. Lección: cuando una
prueba está aprobada, lo que no se lleva tal cual se avisa pieza por pieza
antes de pedir el merge, no después.

Los metros que faltan se quedan: es lo único que la app sabe de verdad de
quien viene. Las fotos son de banco, como las del inicio; qué va en cada
lugar, en `docs/design-system/fotos-landing.md`.

**Dos cosas más del mismo día** (Julieta, con capturas de su celular):

- **La pantalla de arranque de la app instalada.** Al abrirla, Android
  mostraba un fondo blanco con el ícono chico dentro de un cuadrado azul y
  «Oído» en letra de sistema. Ese fondo sale de `background_color` del
  manifiesto (`frontend/app/manifest.ts`), que estaba en blanco; ahora es el
  azul hondo del ícono, y el cuadrado desaparece. Efecto a mirar en un
  celular: Android usa ese color también para su barra de abajo mientras la
  app está abierta. Si molesta, vuelve a blanco y se piensa otra salida.
  Android actualiza una app ya instalada con demora (hasta un día), o al
  reinstalarla.
- **El ícono viejo en Google.** El sitio ya sirve el ícono nuevo
  (`/favicon.ico` publicado es el del repo, visto el 2026-11-18) y lo declara
  bien; lo que muestra Google es su copia guardada, que renueva cuando
  vuelve a pasar. Se acelera pidiendo la indexación de la página de inicio
  en Search Console. De paso se borró `frontend/public/logo.svg`, el logo de
  las manos y la oreja: no lo usaba nada y seguía publicado.

**Queda abierto:** el ejemplo de la comanda sigue siendo «un mozo» y la
oferta dice «Bartender»: son dos ejemplos distintos, como en la prueba.
