# Buscar del comercio con la dirección «con relieve» (beta, etapa 4)

**Pedido:** Julieta, 2026-11-19: «todas las pantallas tienen que tener la misma
estética», después de Buscar del trabajador. Se le mostraron dos opciones sobre
la pantalla real (a 390 y 1280 px) para la lista de trabajadores: **fichas**,
como en Candidatos, o **renglones** con filete, como «Cerca tuyo». Eligió **las
fichas**.

**Qué cambió:** `/search`, la pantalla donde el comercio busca gente cerca, con
el mapa y la lista. La lógica es la misma: el rubro, el radio, desde dónde se
mide y adónde lleva cada persona.

- **La barra de búsqueda es recta y lisa**, blanca con filete: sin el vidrio,
  la sombra flotante ni las píldoras. El rubro y el radio, rectos. **La lupa es
  el botón ámbar con relieve** (antes, un círculo en degradé con resplandor).
- **Los pines del mapa van en azul hondo** con la inicial clara (celeste de
  noche), no en ámbar: el ámbar es la acción. El halo de quien está disponible
  ahora, también en azul hondo. (Sólo lo dibuja este mapa, que también abre el
  admin.)
- **La hoja de abajo** (celular) es papel con la raya azul hondo arriba y
  esquinas de 10 px, sin la sombra difusa.
- **Cada trabajador es una ficha blanca con filete**, con la foto o la inicial
  en un cuadrado recto, las estrellas, la distancia y los oficios en chips
  rectos. Quien está **«Disponible ahora»** lleva el borde y el relieve del
  filete. Antes: tarjetas en gris con una banda de color del rubro al costado
  y sombra difusa.
- La distancia y «hace 5 min» pasan de `ink/40` (2,6 de contraste) a
  `ink-soft`.

Técnico: `app/search/page.tsx` (barra, fichas, esqueleto), `components/BottomSheet.tsx`
(sólo lo usa esta pantalla) y `components/map/WorkerMarker.tsx`. Spec nuevo:
`e2e/buscar-comercio-relieve.spec.ts` (barra, fichas, relieve de la
disponible y contraste de todo lo escrito en las fichas, en los dos temas).

**Por qué así:**

- **Fichas y no renglones:** la persona es el mismo objeto que en Candidatos.
- **Sin título en brocha ni cielo arriba:** es una pantalla de mapa; el cielo
  le comía el plano. El objeto con relieve es la lupa; la ficha de quien está
  disponible ahora es lo destacado de la lista, como el mejor valorado en
  Candidatos.

**Revisión independiente** (otro agente; 320, 390, 768 y 1280, claro y
oscuro, nombres largos, con y sin foto, cinco oficios, sin oficios, sin
nota, disponible con y sin hora, cargando, sin local, error al ubicar el
local y lista vacía, teclado y el pin como admin): aprobada con un arreglo,
hecho acá. A 320 px la barra no entraba: el rubro no se achicaba y la lupa
quedaba fuera de la pantalla (`min-w-0` en el select; lo cubre el spec).
Midió en el navegador que ningún texto de las fichas ni de la barra baja de
4,5 y que la inicial del pin da 8,1 de día y 9,6 de noche. Anotó, de antes,
que con la hoja abierta en el celular la hoja tapa la mitad de abajo de la
barra (la hoja mide el 78 % del alto y va por encima).

**Queda abierto:** las demás pantallas, en el orden del ítem 0 de `STATUS.md`
(sigue Publicar turno).
