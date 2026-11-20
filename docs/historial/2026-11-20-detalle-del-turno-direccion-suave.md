# El detalle del turno con la dirección suave: la foto es el cielo (#699)

**Pedido:** Julieta, 2026-11-20, siguiendo la migración de ADR-0028 con la
maqueta `T-Turno` de la prueba de identidad por pantalla: «la foto del local
es el cielo (arriba, a sangre, con volver y compartir de vidrio). Sin foto va
`PortadaCielo`: chau marrón. Debajo, la hoja con el puesto como título, el
pago como el número más grande, cuándo y dónde en filas y lo que pide el
local. Abajo, fijo, "Postularme" como único ámbar, con las mismas acciones de
hoy. Al postularse, la cinta "¡Oído!" que ya existe.»

**Qué cambió:** el detalle del turno (`/turno/[id]`), sólo la piel. Quién ve
qué, cómo se postula y qué pasa cuando el turno ya no está quedó igual.

- **Arriba, la foto del local a sangre**, con un velo oscuro en la franja de
  los botones. **Sin foto, el cielo** con su nube y el ícono del rubro
  (`PortadaCielo`); se fue el bloque de color por rubro, que era el marrón.
- **«Volver», «Guardar» y «Compartir» son botones redondos de vidrio** sobre
  la foto, de 44 px. «Compartir» subió desde el pie de la página (antes era
  el botón «Compartir por WhatsApp»; hace lo mismo). «Urgente» va como chip
  blanco sobre la foto.
- **La hoja**: el puesto como título en letra normal (se fue la brocha), el
  local y el barrio, y «Comercio verificado» debajo.
- **El pago es el número más grande** (48 px), entre dos rayas, con lo que lo
  explica a la derecha: las horas, el valor por hora y «+ propinas».
- **Cuándo y dónde, en filas** con su ícono; «Cómo llegar» pasó a la fila de
  la dirección (antes era un botón debajo del mapa).
- **«Qué incluye»** (propinas, comida, vestimenta) en chips suaves, **«Lo que
  piden»** (la descripción; antes «Sobre el turno») y el mapa chico.
- **La acción queda pegada abajo**, sobre la barra de la app: «Postularme»,
  el único ámbar. Sin sesión, «Postulate en Oído» con «¿Ya tenés cuenta?
  Ingresá»; para el comercio dueño, «Ver postulantes»; y los avisos «Ya te
  postulaste» y «Ya tuviste este turno asignado» en el mismo lugar.
- **Al postularse, la cinta «¡Oído!»** se pega sobre el borde de arriba de la
  hoja, a la derecha, asomando sobre la foto (antes, sobre la comanda).

Técnico: `frontend/components/ShiftDetail.tsx` (la raíz lleva
`.estilo-suave`; la pieza `Fila`), `frontend/components/ShareShiftButton.tsx`
(prop `vidrio`: sólo el ícono, con nombre «Compartir») y, en
`frontend/app/globals.css`, `.boton-vidrio.sobre-foto`, `.portada-velo`,
`.turno-pago` con el tamaño `--text-pago-grande`, `.turno-accion` y la
`.cinta-oido` reubicada. Tests en `components/ShiftDetail.test.tsx`.

**Por qué así:**

- **Piel sola.** La maqueta trae cosas que hoy no existen y son funciones
  nuevas: «No, gracias» al lado de «Postularme», la distancia («A 900 m»), la
  cuenta regresiva («Empieza en 2 h 40 min»), la nota del local (★ 4,8) y la
  pantalla entera de «¡Oído!» (`T-Oido`). No se agregaron: Julieta pidió «las
  mismas acciones de hoy» y «la cinta que ya existe».
- **La acción va con `position: sticky`, no `fixed`.** Queda pegada al borde
  igual, pero mide lo que mide la hoja (en la compu la columna es angosta) y
  al final del scroll no tapa nada. La pantalla ocupa el alto de la ventana,
  así que con poco contenido el botón queda abajo igual.
- **La foto mide según la pantalla** (34 % del alto, entre 180 y 300 px): con
  300 px fijos, en un celular de 640 px de alto el pago quedaba debajo del
  botón.
- **El encabezado y la barra de abajo de la app siguen**: se migran en su
  propio PR (ADR-0028, punto 5). Por eso la foto empieza debajo del
  encabezado y no desde el borde de la pantalla, como en la maqueta.
- **El lugar que el layout reserva para la barra de abajo es más alto que la
  barra** (80 px contra unos 61): por esa franja se veía pasar la hoja debajo
  del botón. Se tapa con el color de la hoja (`.turno-accion-sobre-barra`).
- **Sin sesión no hay barra de abajo**, pero el layout le reserva lugar
  igual: la pantalla ocupa ese lugar y la acción llega al borde.
- **Los botones sobre la foto son blancos en los dos temas**: la foto no
  cambia de noche. El marcador de «Guardar» ya no es ámbar cuando está
  guardado (sería un segundo ámbar): se llena, en la tinta del cielo.
- **«Creá tu perfil gratis…»** bajó al final de la hoja: con las tres líneas,
  la barra pegada se llevaba un quinto de la pantalla.

**Revisión independiente** (otro agente, intentando romperlo en la app
local: de 320 a 1280 px, celulares bajos y apaisado, claro y oscuro, texto
al 200 %, teclado, «reducir movimiento», y sin sesión, trabajador, comercio
dueño y otro comercio). Aprobó con detalles, y se arreglaron:

- **Con el texto al 200 % la acción pegada tapaba casi toda la pantalla**
  (494 px de alto en un celular de 640). Ahora se mide: si pasa del 40 % del
  alto de la ventana, se despega y queda al final de la hoja.
- **El foco del teclado podía quedar debajo de la acción**: mientras está
  pegada, la pantalla reserva ese alto (`scroll-padding-bottom`) al llevar
  algo a la vista, y lo suelta al salir.
- **Una foto que falla antes de que la página cobre vida** dejaba el ícono
  de imagen rota (el `onError` se perdía; venía de antes): se mira al montar
  y cae al cielo.
- La lista de datos no era HTML válido (`dl` con divs de más): ahora cada
  dato es un grupo `dt` + `dd`. «Ver» mide 44 px de ancho. El marcador de
  «Guardar» pasó de 16 a 20 px. En un celular apaisado la foto ya no se lleva
  toda la pantalla (45 % del alto, hasta 340 px). Sin sesión quedaba una
  rayita del lienzo debajo de la acción.

Una segunda pasada sobre esos arreglos (otro agente, leyendo el código)
aprobó y marcó uno más, ya arreglado: si la foto fallaba una vez, quedaba
descartada aunque después llegara otra; ahora se recuerda qué foto falló.

Midió sin problemas: sin desborde horizontal en ningún ancho; nada queda
inalcanzable debajo de la acción; la cinta no pisa el título, «Urgente» ni
los botones (tampoco «Ayudante de cocina» a 320 px); contrastes de 6,1 para
arriba en los dos temas; toques de 44 px en lo nuevo.

**Queda abierto:** con el texto al 200 % sin sesión, el encabezado de la app
desborda a 320 px (venía de antes, es del encabezado); «Ingresá» es un link
en línea de menos de 44 px (también de antes); las funciones de la maqueta
que no entraron (arriba); el marrón en `ShiftCard`, el mapa y Buscar del comercio; la hora gigante del
Inicio (`design-system/direccion-relieve.md`, «En el código»).
