# Dirección «con relieve» (en prueba)

> **2026-11-19: en la app la reemplaza la dirección suave**
> ([ADR-0028](../adr/ADR-0028-direccion-suave.md), «la hoja sobre el cielo»):
> Julieta la vio «plana», «muy dura» y con todo «del mismo tono» en «Publicar
> turno». Entra de a una pantalla (sección «La dirección suave», al final);
> la primera es «Publicar turno» y «Publicar evento». En la landing esta
> dirección sigue vigente.

> Elegida por Julieta el 2026-11-17 para seguir: afinarla y llevarla a la app
> pantalla por pantalla, un PR cada una, **sin tocar la lógica**. **En la
> landing ya rige** (2026-11-18, ADR-0027); en la app todavía no: ahí lo
> vigente es [`marca-hoy.md`](./marca-hoy.md). Pruebas navegables
> (privadas; se comparten desde su menú Share):
>
> - Primera, landing y app (en claro, con letra y acento intercambiables):
>   https://claude.ai/artifact/WNXBXhkNgGrFdBbqFNsQan
> - Segunda, la landing en tres direcciones (2026-11-18, claro y noche):
>   https://claude.ai/artifact/VWPZtN8eAvxk5U2kVuE3zR
> - Cinco isotipos (2026-11-18): https://claude.ai/artifact/TqfGBkrBX1aGFJSygrsQkS
> - **Tercera, el híbrido (2026-11-18, la que sigue):** la landing de hoy con
>   brocha, isotipo y carta: https://claude.ai/artifact/9Bq2jU9LK7xaCj6b4T2Bxz
> - **La app, segunda prueba (2026-11-18):**
>   https://claude.ai/artifact/MEN8VhUv43HM2sE9pH6kmF

## La idea

El relieve del «oído» fileteado (la sombra dura azul hondo, corrida abajo a la
derecha) pasa a ser la profundidad de la interfaz. En vez de sombras
difusas, **un objeto con relieve por pantalla**: el botón principal (ámbar,
letra tinta, sombra dura de 3 px que se aprieta al tocar) y la tarjeta que
importa (el turno para vos, el turno que se está buscando, el candidato
recomendado). Lo demás, plano y con hairline.

## Qué tiene la prueba

- **Landing:** avisos «en vivo» que flotan y se inclinan con el mouse, la
  palabra que cambia con un subrayado a mano en azul hondo, la comanda que se
  escribe, se arma y recibe el sello «¡Oído!», un radar sobre el mapa de
  Palermo con quién se postula, tres pasos con relieve, una cinta con los
  puestos y el cierre con el «oído» fileteado (sin el Sol de Mayo).
- **App:** el cielo arriba del Inicio, la tarjeta «Para vos, ahora» con foto,
  el detalle en una hoja que sube, «Me postulo» que se vuelve «¡Oído! Te
  avisamos si te eligen», el camino del turno (confirmado, salí, llegué,
  terminé), el panel del comercio con el reloj de los 10 minutos y el
  «¡Oído!» a pantalla completa al asignar. Barra de abajo flotante.

## Referencias de Julieta (2026-11-17)

Son ejemplos de nivel de cuidado, no estilos para copiar.

- **Web de clases particulares hecha con IA:** papel cuadriculado, tarjetas
  que reaccionan al mouse, fórmulas que se dibujan a mano, la palabra en
  cursiva que cambia. Se tomó: objetos que se mueven con el mouse, trazos a
  mano, la palabra que cambia.
- **Landing de una pizzería porteña:** títulos con voz de oficio, un objeto
  enorme y recortado por sección, el menú como carta con precios, lo local
  concreto (esquina, horarios, reseñas con nombre) y un «instructivo»
  numerado con notas a mano. Para la próxima vuelta: títulos que hablen como
  la cocina, personas recortadas sobre el cielo en vez de fotos en tarjetas,
  los planes como una carta de bodegón, minutos reales y barrios.
- **Microinteracciones de diseñador** (Tidemark y otras): un recibo que se
  imprime al elegir el plan y cambia el total, con una nota a mano en un
  círculo y el paisaje de fondo que pasa de tarde a noche; un interruptor de
  día y noche que es un paisajito; un mapa que se despliega con una lupa. Lo
  que pidió Julieta con esto: **evitar lo genérico de la IA**; cada efecto
  sale de un objeto real del oficio. Para Oído: la comanda que se imprime en
  los precios (papel de cocina, no recibo; la nota a mano en azul hondo), el
  riel de comandas en el panel del comercio (los turnos avanzan por el riel),
  el interruptor de tema como un cielito que pasa a la noche azul, y una lupa
  sobre el mapa de Palermo en «va en camino».

**Qué no se toma de ninguna:** la base crema con azul francia y la
ilustración de línea (es el terreno de otra marca del rubro; ver
`marca-hoy.md`, regla 5).

## Segunda prueba de la landing (2026-11-18)

De la pizzería se tomó cómo está armada, no su estilo. Julieta pidió ver las
tres direcciones; están en una sola página, con pestañas. Las tres comparten
el sistema y cambian el héroe, el objeto grande y el orden.

| Dirección | Primera pantalla | Objeto | A favor / en contra |
|---|---|---|---|
| **El pase** (recomendada) | «¡Marcha un bartender!» (la palabra cambia) y la comanda colgada del riel con el «¡Oído!» encima | El riel de comandas | Explica el producto con el gesto que le da nombre; no depende de fotos. «Marcha» necesita la bajada para quien no es del rubro |
| **El bodegón** | «Sacá el cartelito de la vidriera.» | El cartel de «se busca mozo/a» pegado con cinta | El más gracioso y el más quieto. Habla de contratar, no de cubrir hoy |
| **Un servicio en vivo** | «Se te cayó uno. Ya va otro.» | El reloj de la cocina, de 20:02 a 20:11 | El más claro. Los minutos se leen como dato real aunque diga «ejemplo» |

Lo que comparten, cada pieza con su objeto de cocina:

- **Títulos con voz de cocina:** «Cantá la comanda», «Instructivo para cubrir
  un turno (sin llamar a tu primo)», «La carta», «¿Libre esta noche? Hay
  turno a la vuelta.», «Andá abriendo. Alguien va.».
- **Letra de cartel pintado** en los títulos, con un interruptor contra
  Young Serif: Carter One (la letra «casual» de los letristas) y Knewave
  (pincel). Las notas a mano van en Mansalva, de una tipógrafa argentina, y
  siempre en azul hondo. Se probaron y se descartaron Barrio, Bahiana y
  Londrina (infantiles). Sedgwick Ave Display, descartada primero por venir
  del grafiti, se sumó después como «Brocha» porque a Julieta le gustó.
- **La comanda que se imprime** sale hacia arriba de la impresora de la
  cocina, renglón por renglón, y recibe la cinta «¡Oído!». Es papel de
  cocina: sin número, sin raya punteada, datos en Inter.
- **El instructivo:** un celular con tres zonas y tres notas a mano con el
  número en un círculo dibujado. Lleva números porque es una secuencia.
- **La carta:** los planes vigentes (Inicial, Básico, Pro, leídos de
  `components/landing/planes.ts`) como carta de bodegón, con doble filete,
  «sugerencia de la casa» y «No cobramos cubierto». Al elegir un plato se
  imprime la comanda de la caja con el total del mes y comisión $ 0.
- **Para trabajar:** la pizarra del día, con turnos de ejemplo.
- **Botones rectos con relieve** (radio 10 px), no píldoras; el ámbar con
  letra tinta queda sólo en «Necesito personal». **Pie de color** azul hondo.
- **Sin números inventados:** no hay contador en vivo ni pago del turno; los
  pedidos, las personas y los horarios dicen que son ejemplos.

Mirada con Playwright en 1280 y 390 px, en claro y en noche, sin desborde ni
errores de consola.

## Tercera prueba: el híbrido (2026-11-18)

Julieta vio las tres direcciones y no eligió ninguna: «queda todo casi de un
mismo tono, se pierde el cielo de la landing y el efecto de las personas
girando, y tiene subtítulos contando lo que ya hace; todo eso da a hecho con
IA». Le gustaron **la letra de brocha** (Sedgwick Ave Display), **Mansalva**
para lo anotado a mano y **los planes como menú**. Pidió un híbrido de la
landing publicada con el isotipo nuevo y esas mejoras, y seguir modificando
hasta la final.

El híbrido parte de la landing de hoy, sección por sección y con sus textos
(`HeroRueda`, `Comanda`, `MapaCamino`, `Precios`, `ParaTrabajar`, `Preguntas`,
`Cierre`), y cambia sólo esto:

- **Letra mixta** (propuesta tras verla Julieta: «en el héroe queda muy
  bien», en títulos largos se lee más lento): brocha sólo donde habría un
  cartel pintado (el título del inicio, el cierre y los nombres de la carta),
  en mayúsculas y azul de la marca. La palabra que cambia sigue en ámbar.
  A Julieta la mixta le gusta, pero **Young Serif no la convence** para los
  títulos de sección («genérica»): hay un interruptor con tres candidatas,
  **Abril Fatface** (recomendada: es la hermana derecha de la Shrikhand del
  «oído», la letra gorda de los carteles), **Alegreya** negra (argentina,
  caligráfica) y **Caprasimo** (gordita, de fiambrería), contra Young Serif.
- **El isotipo no va junto al «oído»** (decisión de Julieta, 2026-11-18):
  queda sólo como ícono de la app. Se sacó del encabezado y del pie, y del
  encabezado de la prueba de la app.
- **El mapa** va en celeste, con quien va acercándose al bar y la ficha «Va
  en camino», sin reloj ni horarios: en la landing un reloj se lee como
  promesa.
- **Los precios como carta**, con «sugerencia de la casa» en Mansalva. La
  acompaña una **pizarra de bodegón** donde la tiza escribe el plan elegido y
  marca los turnos con palitos de a cinco (uno para Inicial, tres para
  Básico, y siguen con puntos para Pro). Primero tenía una segunda comanda
  saliendo de la caja; Julieta la sacó el 2026-11-18: «dos comandas es
  redundante», la carta pide otra animación.
- **La comanda** sale de la misma impresora oscura de hoy, como papel de
  cocina, y recibe la cinta «¡Oído!». Es la única comanda de la landing.
- **Botones de hoy con el relieve** azul hondo en lugar de la sombra difusa.
- **Pie de color** azul hondo; el cierre va **sin el Sol de Mayo**.
- Ninguna bajada: una idea por sección, como manda `marca-hoy.md`, regla 1.

Lección para las próximas vueltas: se parte de la landing publicada y se
cambia de a una pieza; las tres direcciones de la segunda prueba quedan como
cantera de piezas, no como camino.

## La app, segunda prueba (2026-11-18)

Julieta mandó el video de la app «con relieve» de la primera prueba como
ejemplo a mejorar. Se rehízo con las mismas pantallas y los mismos pasos
(Inicio, detalle, Mis turnos; Panel, Candidatos, el «¡Oído!» al asignar), en
dos celulares que se hablan, en claro y en noche:

- **El turno es una comanda** de papel con relieve, en el Inicio, en el
  detalle (sube entera, en lugar de la hoja con mosaicos de datos) y en Mis
  turnos. Al postularse recibe la cinta «¡Oído!».
- **El panel del comercio es el riel**: los turnos cuelgan y cada comanda
  dice en qué anda (buscando, confirmado, salió, llegó, terminado).
- **Lo hecho se tacha a mano**, como en el pase: confirmado, salí, llegué,
  terminé. Lo que hace quien trabaja se ve en la comanda del comercio.
- **«Disponible» es el cartelito de la puerta**, que se da vuelta al tocarlo.
- **Sin rótulos en letra mono ni píldoras:** rótulos en Inter, botones
  rectos, listas con filete fino, y la barra de abajo pegada al borde con una
  raya azul hondo en lo activo (antes flotaba, de vidrio).
- Brocha sólo en el título de cada pantalla y en el puesto de la comanda;
  Mansalva en dos apuntes («para hoy», «el que te recomendamos»).

**Acentos (misma fecha).** Julieta mandó capturas de la app de hoy: «todo
se ve plano, todo parece un formulario del mismo tono», y pidió que lo nuevo
no se vea así. Cada pantalla tiene ahora su propio tono, siempre dentro de la
paleta: cielo pleno con nubes en el Inicio, con la comanda montada sobre el
borde; el riel sobre una banda azul hondo; Mis turnos con encabezado azul
hondo; Candidatos sobre celeste. Suman color las fotos en «Cerca tuyo», el
cartelito de «Disponible» en verde (como el de «abierto») y los estados como
sello de goma (verde para confirmado y llegó). El ámbar sigue sólo en la
acción principal.

Falta mirarla con Julieta y decidir qué de esto entra a la app real.

## Isotipo (2026-11-18)

Cinco conceptos en vector, a 16, 32, 180 y 512 px, en claro y oscuro, en la
pestaña y en el celular junto al «oí» de entonces: la voluta (filete), el pinche
(la comanda clavada), la campanita (el pase), grito y respuesta, y la o que
grita.

**Se recomendó «grito y respuesta»** (los dos signos de «¡Oído!»), pero
**Julieta eligió otro después de verlos: el pinche con «oído»** (2026-11-18),
la comanda de papel clavada en el pinche de la cocina con la palabra
fileteada en el papel y, de 48 px para abajo, la misma comanda con la «o»
sola. Está en el código (ver `marca-hoy.md`, regla 4). La voluta queda como
adorno, no como ícono. El brief de abajo era para «grito y respuesta»; si se
encarga a un fileteador, hay que reescribirlo para el pinche.

**Brief para un fileteador** (conviene encargarlo con el concepto cerrado, no
como exploración abierta):

- dos pinceladas y dos puntos, «¡» y «!», inclinados como la Shrikhand;
- legible a 16 px sin relieve; relieve azul hondo y luz de pincel sólo de
  48 px para arriba;
- blanco y un solo ámbar (`#D97706`) sobre azul hondo (`#1C5478`), y versión
  sobre noche azul;
- entrega en vector, más una versión de un solo color y una con margen para
  Android;
- sin Sol de Mayo, sin orejas ni manos, sin papel con renglones.

## Decidido por Julieta (2026-11-18)

- **Letra mixta:** brocha (Sedgwick Ave Display) sólo en el título del
  inicio, el cierre y los nombres de la carta; **Abril Fatface** en los
  títulos de sección, en lugar de Young Serif; Mansalva para lo anotado a
  mano; Inter para el texto. Rige en la landing desde el 2026-11-18
  (`typography.md`, `marca-hoy.md`).
- **Isotipo: el pinche con «oído»**, elegido por Julieta el 2026-11-18 después
  de verlo, sólo como ícono de la app (no va junto al «oído»). Ya reemplazó al
  «oí» en el código.
- **Los planes como carta**, y la base de la landing es el híbrido.

## Decidido por Julieta (2026-11-19)

Para lo que es de toda la app. Lo que la prueba de la app no dibujaba se le
preguntó con opciones puestas sobre las pantallas ya migradas (capturas a
390 px de las pestañas en el Panel, Mis turnos y Candidatos):

- **Barra de abajo:** como la prueba. Pegada al borde, lisa (sin vidrio ni
  píldora), con un filete arriba; lo activo lleva una raya azul hondo de 3 px
  sobre la pestaña y va en tinta, lo demás en `ink-soft`.
- **Pestañas:** **raya azul hondo** (elegida entre la raya, una pista recta
  con la activa llena en azul y fichas de carpeta). Texto plano con un filete
  abajo; la activa en tinta con la raya debajo, el mismo gesto que la barra.
- **Botones secundarios:** como la prueba (`.btn-liso`): rectos, blancos con
  filete y planos; el relieve queda para el principal.
- **Pasos tachados a mano: en un renglón** (no en lista): las cuatro palabras
  una al lado de la otra, lo hecho tachado a mano en azul hondo, lo actual en
  negrita y lo que falta apagado. Los hitos y sus nombres no cambian.
- **Detalle del turno:** sigue siendo página (`/turno/[id]`; hacerla hoja
  cambiaría la navegación). La foto arriba y el turno como comanda con
  relieve; **el pago va en la comanda, como último renglón con el número
  grande** (ya no en una banda celeste aparte). Al postularse, la cinta
  «¡Oído!» sobre el papel.

## Falta que decida Julieta

1. Qué le cambia al híbrido (es la base desde el 2026-11-18).
2. Si el isotipo se encarga a un fileteador o se queda el vector propio.
3. Qué de la prueba de la app entra a la app real, y en qué orden.
4. Antes de producción, confirmar contra el producto lo que la prueba afirma:
   «Gratis para quien trabaja», «gente verificada» y «Hecho en Buenos Aires».

## Qué conviene llevar a producción, y en qué orden

1. ~~La comanda como papel de cocina~~ **Hecho el 2026-11-18:** la comanda
   de la landing va en Inter, con filete liso y corte recto
   ([historial](../historial/2026-11-18-comanda-papel-de-cocina.md)).
2. ~~**Los tokens del relieve** en `globals.css` (sombra dura, botón recto,
   radio), sin romper los que hay y con ADR si cambia el sistema.~~ **Hecho
   el 2026-11-18:** `--relieve`, `--shadow-relieve` (y `-md`, `-lg`),
   `--radius-relieve`; [ADR-0027](../adr/ADR-0027-relieve-como-profundidad.md).
3. ~~**El isotipo**: primero el vector provisorio en lugar del «oí»
   (`scripts/build-icons.mjs`), después el del fileteador.~~ **Hecho el
   2026-11-18:** el pinche con «oído» es el ícono de la app (vectores en
   `marca/isotipo-pinche*.svg`); lo del fileteador queda opcional.
4. ~~**Los precios como carta** (`Precios.tsx`)~~ **Hecho el 2026-11-18**,
   con la pizarra. Los planes y los precios no cambiaron.
5. ~~**El héroe elegido, los títulos y la letra**, con el pie de color.~~
   **Hecho el 2026-11-18** sobre el híbrido (el héroe es el de la landing
   publicada, en brocha; el instructivo era de la segunda prueba y no entró).
   **El pie de color no quedó:** Julieta lo vio en el código y lo sacó, junto
   con la palabra cortada por el borde. El final es el «oído» entero sobre
   un banco de nubes, con sólo lo legal debajo.
   Detalle y lo que se apartó de la prueba, en el
   [historial](../historial/2026-11-18-landing-hibrida.md).
6. **La app**, pantalla por pantalla, en el orden de abajo.

## Antes de llevarla a la app

1. Afinar la prueba con lo que marque Julieta (la landing ya se miró en
   oscuro el 2026-11-18; la app, todavía no).
2. ~~Definir los tokens nuevos~~ Hechos (ADR-0027): usar `--shadow-relieve*`
   y `--radius-relieve`, no valores sueltos.
3. Un PR por pantalla, en este orden: ~~Inicio del trabajador~~ (hecho el
   2026-11-18, [historial](../historial/2026-11-18-inicio-trabajador-relieve.md)),
   ~~Panel del comercio~~ (hecho el 2026-11-18,
   [historial](../historial/2026-11-18-panel-comercio-relieve.md)),
   ~~Candidatos~~ (hecho el 2026-11-18,
   [historial](../historial/2026-11-18-candidatos-relieve.md)), ~~Mis
   turnos~~ (hecho el 2026-11-18,
   [historial](../historial/2026-11-18-mis-turnos-relieve.md)); ~~la
   landing~~ (hecha). Capturas en claro y oscuro.
4. **Lo que es de toda la app**, un PR cada cosa, en este orden (Julieta,
   2026-11-19): ~~la barra de abajo~~ (hecha el 2026-11-19,
   [historial](../historial/2026-11-19-barra-de-abajo-relieve.md)), ~~las
   pestañas~~ (hechas el 2026-11-19,
   [historial](../historial/2026-11-19-pestanas-relieve.md)), ~~los botones
   secundarios~~ (hechos el 2026-11-19,
   [historial](../historial/2026-11-19-botones-secundarios-relieve.md)), ~~los
   pasos tachados a mano~~ (hechos el 2026-11-19,
   [historial](../historial/2026-11-19-pasos-tachados.md)), ~~los colores
   de los sellos~~ (hechos el 2026-11-19,
   [historial](../historial/2026-11-19-colores-de-los-sellos.md)) y ~~el
   detalle del turno~~ (hecho el 2026-11-19,
   [historial](../historial/2026-11-19-detalle-del-turno-comanda.md)).
5. **El resto de las pantallas**, un PR cada una (Julieta, 2026-11-19: «todas
   las pantallas tienen que tener la misma estética, no puede quedar a
   medias»). Antes de escribir cada una, se le muestran las opciones puestas
   sobre la pantalla real. Orden: ~~Buscar del trabajador~~ (hecho el
   2026-11-19, cada turno como comanda; [historial](../historial/2026-11-19-buscar-trabajador-relieve.md)),
   ~~Buscar del comercio~~ (hecho el 2026-11-19, fichas;
   [historial](../historial/2026-11-19-buscar-comercio-relieve.md)), ~~la
   bienvenida~~ (hecha el 2026-11-19, con el cielo y el «oído» plano;
   [historial](../historial/2026-11-19-bienvenida-relieve.md)), Publicar turno, Chats, Perfil, Mapa, las
   fichas, Favoritos, Mi plan, y el ingreso, el alta y la bienvenida. Cómo va cada uno, en «Decidido por
   Julieta (2026-11-19)».

## Piezas compartidas de la app (desde el Inicio del trabajador)

Antes de dibujar algo nuevo en una pantalla, usar éstas:

| Pieza | Dónde | Para qué |
|---|---|---|
| `LETRAS_APP` | `frontend/lib/letras.ts` | La brocha y Mansalva. Va en el contenedor de cada pantalla migrada (no en el layout raíz) |
| `.letra-cartel` (con `-pantalla` o `-puesto` para el tamaño) + `textoCartel()` | `globals.css`, `components/ui/Comanda.tsx` | Título de la pantalla y puesto de la comanda, en brocha. `textoCartel` saca la barra de «Mozo/a» a la letra de texto |
| `.app-cielo` | `globals.css` | El cielo de arriba de la pantalla (celeste de día, azul noche de noche). Lo de encima hereda `--app-cielo-tinta` |
| `Comanda`, `ComandaFila` | `components/ui/Comanda.tsx` | El turno como papel de cocina, con relieve. Adentro va forzada a claro: el papel es papel en los dos temas |
| `Apunte`, `.letra-mano` | ídem | Un apunte a mano con óvalo. Uno por pantalla |
| `Flechita` | ídem | La flechita a mano que acompaña un apunte («el que te recomendamos») |
| `.tarjeta-relieve` | `globals.css` | Lo destacado de una lista (el candidato recomendado): blanco con el borde y el relieve del filete. Uno por lista |
| `.sello-goma` + `.sello-verde` / `-azul` / `-rojo` / `-gris` | `globals.css` | Un estado como sello de goma, sobre el papel. Cuatro tintas fijas (el papel es claro en los dos temas): verde lo que salió bien, azul hondo lo que está en curso, rojo cancelado y «Urgente», gris lo que no arrancó o no se cubrió |
| ~~`.cartelito`~~ | — | Se borró el 2026-11-19: «Disponible» es un chip de vidrio en el Inicio suave |
| `AIAssistantBar recto` | `components/AIAssistantBar.tsx` | El buscador sin píldora ni sombra |
| `ShiftCard comanda` | `components/ShiftCard.tsx` | La tarjeta de un turno (con sus pasos y acciones) como comanda: puesto en brocha y estado como sello. La usa el panel; «Mis turnos» la toma pasando el prop |
| `.app-banda` + `.riel` | `globals.css` | La banda azul hondo donde cuelgan las comandas en curso, y la barra del riel. Sobre la banda el relieve cambia de tono solo |
| `BOTON_LISO` y `Button` `surface` | `components/ui/Button.tsx` | El secundario: blanco, recto (10 px, el radio del principal), con filete y plano. `BOTON_LISO` es para lo que no puede ser un `Button` (un `Link`, un `<a>`) |
| `ShiftLifecycleStepper` + `.pasos-tachados` | `components/ShiftLifecycleStepper.tsx`, `globals.css` | Los pasos del turno en un renglón: lo hecho tachado a mano en azul hondo (`.tacha`), lo actual en negrita |
| `OportunidadComanda` | `components/worker/OportunidadComanda.tsx` | Un turno abierto a postulaciones como comanda, con sus acciones («Cómo llegar», «Compartir», «No, gracias», «Postularme»). La usa Buscar del trabajador |
| `.boton-relieve` | `globals.css` | El relieve del botón principal: borde azul hondo, sombra dura, se aprieta. El fondo lo pone quien lo usa. Desde el 2026-11-18 lo lleva `Button` en su variante `primary` en toda la app (sigue en ámbar): un principal plano al lado de uno con relieve desentona |

## La dirección suave (2026-11-19, ADR-0028)

Con «Publicar turno» se probaron sobre la pantalla real, en este orden: sin
cielo y con cielo; el pedido como comanda colgada del riel, con los renglones
alineados; los puestos en pizarra, en carta y en fichas rectas; controles con
filete azul y relieve chico; casillas rectas o interruptor recto. Julieta los
rechazó («plano, todo del mismo tono», «la brocha es un exceso para lo que no
es título», «muy duro») y mandó cuatro referencias: color atrás, superficies
claras adelante, sombras difusas, esquinas redondeadas y títulos grandes en
sans. Con eso quedó **la hoja sobre el cielo** (detalle en el ADR):

- el cielo arriba con la vuelta de vidrio, los pasos tachados y el título en
  letra normal grande (`.titulo-pantalla`); debajo, la hoja blanca (`.hoja`);
- lo que se toca, teclas suaves (`.tecla`); el sí/no, una casilla redonda;
  donde se escribe, relleno sin borde (`.campo`); la ayuda, celeste
  (`.nota-ayuda`); el principal, ámbar en degradé con sombra de su color;
- el turno que se publica como tarjeta (`components/PedidoTarjeta.tsx`).

**Cómo se migra:** la pantalla lleva `.estilo-suave` en su raíz y los
componentes compartidos se ven suaves sólo adentro. Orden propuesto, un PR
cada uno, sin tocar la lógica:

1. «Publicar turno» y «Publicar evento» (hecho el 2026-11-19).
   **El Inicio de quien trabaja** también está (2026-11-19, adelantado: es la
   primera de la prueba de identidad): piel sola, sin tocar la lógica.
2. Lo compartido de toda la app: la barra de abajo, el encabezado, las
   pestañas y las hojas (`BottomSheet`, «¡Turno publicado!»).
3. La bienvenida y el ingreso/alta.
4. Buscar, del trabajador y del comercio.
5. El Inicio, el detalle del turno, Mis turnos, el Panel y Candidatos (las
   comandas pasan a la tarjeta del turno).
6. Chats, Perfil, Mapa, fichas, Favoritos y Mi plan.
7. Las reglas de `.estilo-suave` pasan a `:root` y se borra lo de «con
   relieve» que quede en la app.

## Identidad por pantalla (2026-11-19, prueba; falta que decida Julieta)

Prueba con dieciséis pantallas, en claro y en noche, enlazadas entre sí:
https://claude.ai/artifact/WJn8NkYTpvSsa81RpoR2Jg (privada). La tercera fila
es la segunda vuelta (más abajo).

Con el cielo y la hoja iguales en todas, las pantallas se vuelven a parecer.
La regla que se propone: **el cielo muestra lo que la pantalla responde y la
hoja es donde se actúa**. Cambian cuatro cosas, siempre dentro de la paleta:
el alto del cielo, lo que vive en él, cómo se encuentra con la hoja y si es
el cielo de día o el hondo.

| Pantalla | Pregunta | El cielo | Lo propio |
|---|---|---|---|
| Inicio (trabaja) | ¿Qué tengo hoy? | Alto, con nubes | La frase que termina en la hora gigante («Hoy trabajás a las 20:00») y el ámbar sobre el cielo |
| Buscar (trabaja) | ¿Qué turno tomo? | Corto, con el buscador de vidrio | El pago en grande en cada fila; la marca («Urgente», «Paga más») al final del renglón |
| Mapa | ¿Qué hay cerca? | El mapa es el cielo (se funde arriba) | El pago en el pin; el elegido, en azul hondo |
| El turno | ¿Me conviene? | La foto del local es el cielo | El pago es el número más grande de la hoja |
| Mis turnos | ¿Qué tengo y en qué anda? | Medio, con la semana | La tarjeta de hoy lleva su propio cielo y los cuatro pasos |
| Chats | ¿Quién me escribió? | Corto y liso, sin nubes | Cada chat cuelga de su turno |
| Perfil (trabaja) | ¿Cómo me ven? | Medio; la foto a caballo de la hoja | La reputación como número grande y una reseña |
| Panel (comercio) | ¿Está cubierto? | **Hondo** (el servicio en marcha) | El número de turnos de hoy y sus tres estados |
| Candidatos | ¿A quién elijo? | Corto | La recomendada como tarjeta de foto con el nombre encima |
| «¡Oído!» | Listo | Entero, sin hoja | El único momento de marca: la cinta y las dos fotos |

Lo que la prueba cambia de lo ya decidido (hay que decidirlo de nuevo):

1. **Barra de abajo:** flota sobre la hoja, blanca y con sombra difusa (la
   decidida el 2026-11-19 va pegada al borde con una raya azul).
2. **Pestañas:** una pista hundida con la elegida como tecla (la decidida
   es texto con raya azul).
3. **«Publicar turno» del comercio:** un «+» redondo azul hondo al lado de
   la barra. No va en ámbar: el ámbar queda para la acción de cada pantalla.
4. **El cielo hondo** para el Panel (sale de la banda azul hondo de la
   dirección anterior).

Antes de llevarla al código hay que confirmar contra el producto: «Empieza en
2 h 40 min», «puntual en 31», la calificación del comercio en el turno, «Ya
se postularon 4» con las fotos y el tiempo de «Buscando hace 3 min». La cinta
«¡Oído!» de la prueba está dibujada con CSS; en la app la dibuja
`components/landing/Filete.tsx`. Las fotos son las de banco de la landing y
las personas sin foto van con iniciales.

### Segunda vuelta (2026-11-19, misma prueba)

Julieta preguntó si era la mejor versión. No lo era: prolija, pero podía ser
cualquier app de turnos, sólo mostraba el caso lindo y la promesa (cubrir en
minutos) no se sentía. Dijo «confío en tu criterio», y se hizo esto:

- **El cielo tiene dos estados con sentido:** celeste cuando no pasa nada y
  **hondo cuando algo está en marcha** (el comercio buscando; quien trabaja
  con el turno por empezar). De noche el cielo lleva unas pocas estrellas.
- **La frase que termina en el número gigante** es la firma de las pantallas
  de arranque: «Hoy trabajás a las **20:00**», «Empezás en **28 min**»,
  «Buscamos hace **3 min**». En el Panel reemplaza a «3 turnos para hoy»,
  que era un dato de tablero. Es tiempo transcurrido, no una cuenta
  regresiva: no promete los 10 minutos.
- **La voz de la cocina en los textos, no en los controles:** «Marchando»,
  «Todavía nadie cantó «oído»», «Cantás el pedido», «¿Te falta alguien
  hoy?», «Hay turno a la vuelta». La cinta «¡Oído!» aparece dos veces: al
  postularse y al elegir.
- **Estados que faltaban:** Inicio con el día libre y con el turno por
  empezar; Panel el primer día, buscando y sin postulados a los 8 minutos
  (con tres salidas: subir el pago, invitar a un favorito, cambiar el
  horario); Candidatos sin fotos (la recomendada con iniciales y tres datos)
  y un nombre largo cortado.
- **Buscar y Mapa son una sola pestaña** con un conmutador Lista / Mapa: la
  barra de quien trabaja queda en cinco. Cambia la navegación de hoy (seis).
- **Movimiento:** la cinta cae como un sello, las dos fotos llegan de los
  costados, el punto de «Marchando» late y las nubes derivan apenas. Todo se
  apaga con `prefers-reduced-motion`.
- **«Va en camino» a la vista de quien lo prende:** «El bar ve que vas en
  camino. Sólo tu última posición. Lo apagás cuando quieras.»

Se suma a lo que hay que confirmar contra el producto antes del código: «Ya
estamos avisando más lejos, hasta 5 km», «en tu zona se paga cerca de
$ 66.000» (sale del pago de referencia, ADR-0012), invitar a un favorito a un
turno, «Ya trabajó 3 veces con vos», «Retirar mi postulación» y «8 turnos a
menos de 3 km». Los textos nuevos son propuesta: no tocan `/terminos`.

Falta: probarla con dos dueños y tres personas que trabajan; celular chico
(360 px) y letra grande; el vidrio esmerilado en Android de gama baja; y las
pantallas que no entraron (ingreso y alta, Favoritos, Mi plan, y Buscar,
Chats y Perfil del comercio).

### Tercera vuelta: el cielo (2026-11-19, misma prueba)

Julieta mandó más referencias (nubes con volumen, cielos más limpios) y
dijo que el cielo «no termina de ser muy cool como pusiste las nubes»: eran
manchas blancas desenfocadas, cortadas por los bordes. Cambió esto:

- **Nubes modeladas, no manchas:** una masa blanda con luz de arriba a la
  izquierda y sombra celeste abajo, como de arcilla. Son tres formas (cúmulo,
  chica y banco largo) guardadas como imagen con transparencia (unos 10 KB
  cada una en WebP), dibujadas por nosotros con un mapa de altura; no son de
  banco ni generadas con IA.
- **Pocas y con intención:** una grande que asoma arriba a la derecha, detrás
  de los botones de vidrio, y a lo sumo una chica y más tenue «de lejos».
  Nunca detrás de un texto. En las pantallas «¡Oído!», un banco de nubes
  abajo, como el cierre de la landing.
- **Sobre el cielo hondo** van al 30 %: se leen como nubes en penumbra y no
  compiten con la letra blanca. **De noche no hay nubes, sólo estrellas:**
  al 16 % parecían humo.
- **El cielo, un poco más vivo:** `#5BA8E0` → `#84C0EC` → `#BFE1F6` (antes
  `#6FB0DF` → `#8CC2E7` → `#B4D8EF`), con una luz suave arriba a la derecha.
  La tinta `#0F3A5B` da 4,6 sobre el tono más oscuro. Es un cambio de valores
  de la marca: si queda, hay que llevarlo a `globals.css` y a
  `color-system.md` en el PR de la primera pantalla.

Para el código: las nubes van como imagen (`<img>` decorativo, `alt=""`),
no como filtro ni `backdrop-filter`, así no pesan en Android de gama baja.

**Criterio (Julieta, 2026-11-19):** «siempre lo que estéticamente quede mejor
con el producto; yo sólo estoy tirando ideas y referencias». Las referencias
son insumo, no pedido: lo que no suma se dice y no se hace. Con eso queda:
el celeste más vivo (hay que llevarlo a la app y a la landing juntas), la
noche sin nubes, y **afuera** los objetos 3D flotando, el mapa en relieve y
el vidrio en todos lados.

### En el código (2026-11-19): el Inicio de quien trabaja

Piezas nuevas, para usar en las pantallas que siguen (antes de dibujar otra):

| Pieza | Dónde | Para qué |
|---|---|---|
| `NubesCielo` + `.cielo-limpio` | `components/ui/NubesCielo.tsx`, `globals.css` | Las nubes con volumen adentro de un `.app-cielo`. `.cielo-limpio` apaga las manchas viejas y de noche deja sólo estrellas (a la derecha, lejos de los textos) |
| `PortadaCielo` | `components/ui/PortadaCielo.tsx` | La portada de un turno **sin foto**: el cielo, una nube (varía con el id, estable) y el ícono del rubro en un círculo de vidrio; de noche, el azul hondo. `mini` para miniaturas. Reemplaza al bloque marrón |
| `build-nubes.mjs` | `frontend/scripts/` | Escribe `public/cielo/nube-{a,b,c}.webp` (mapa de altura y luz, en Node con `sharp`) |
| `.campo-vidrio`, `.chip-foto` | `globals.css` | El buscador sobre el cielo y el chip blanco sobre una foto o una portada |
| `--text-titular`, `--text-puesto`, `--text-pago`, `--text-fila` | `globals.css` | Los tamaños de la dirección suave (46, 19, 26 y 15 px) |

El cielo de la app pasó a `#5BA8E0` → `#84C0EC` → `#BFE1F6` con la luz arriba
a la derecha (`--app-cielo-*`, `--app-cielo-luz`), para todas las pantallas
con `.app-cielo`. **La landing sigue con el anterior** (`--l-*`) hasta su PR.

Queda de este paso:

1. ~~**La hora gigante**~~ **Hecha el 2026-11-20** (`lib/inicio-estado.ts`,
   `components/worker/CieloInicio.tsx`, `.cielo-hondo`, `.numero-gigante`;
   [historial](../historial/2026-11-20-inicio-titulo-dice-la-verdad.md)). Lo
   que sigue de este punto era la nota original: es
   una función nueva, no piel. Los datos ya llegan al Inicio: `GET
   /applications/mine` trae las postulaciones con el turno embebido; la
   asignada es `status === "aceptada"`, la hora `shift.start_at` y «hoy»
   `isTodayInArgentina`. Falta confirmar que `shift` viene siempre poblado.
2. **El marrón que queda** (sale de `SKILL_HERO_TONE` en `lib/skill-style.tsx`,
   con letra blanca encima, así que se cambia pieza por pieza):
   `components/ShiftCard.tsx` (panel del comercio y Mis turnos),
   `components/ShiftDetail.tsx` (cabecera del detalle), los cuadraditos de
   `app/map/page.tsx` y de `app/search/page.tsx`.
3. **En escritorio**, la grilla de `OpportunityCard` sigue con la letra y los
   botones de antes (varios «Postularme» ámbar): es una pieza de otra etapa.
4. El cielo nuevo en la landing; el encabezado y la barra de abajo.

**Vidrio (Julieta, 2026-11-19, con referencias de componentes de cristal
grueso):** se toma el brillo, no el cristal. Dentro de `.estilo-suave` el
botón ámbar lleva una luz arriba y una sombra fina abajo, y el vidrio sobre el
cielo un borde de luz. Nada de reflejos tornasolados ni de vidrio sobre blanco.
