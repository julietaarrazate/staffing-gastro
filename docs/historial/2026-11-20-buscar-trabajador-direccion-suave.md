# Buscar, de quien trabaja, con la dirección suave (#PRNUM)

**Pedido:** Julieta, 2026-11-20, tanda de tres pantallas en paralelo (Mis
turnos, Buscar de quien trabaja y Chats) para seguir la migración a la
dirección suave (ADR-0028). Maqueta: `T-Buscar` del lienzo «Oído · identidad
por pantalla». Sólo la piel.

**Qué cambió:** `/buscar`. Qué se pide, cómo se filtra y qué hace cada botón
quedó igual.

- **Arriba, el cielo corto** con una nube que asoma a la derecha (de noche,
  estrellas). El título «Buscar turnos» va grande y en letra normal; se fue
  la brocha.
- **Los rubros son chips de vidrio** sobre el cielo, en un carril que se
  desliza; el elegido va en azul hondo. Antes eran pestañas con raya.
- **Debajo sube la hoja** con «Urgentes» y «Mejores pagos» como chips suaves
  (prendidos, en azul hondo) y una línea que dice cuántos turnos hay y en qué
  orden están («5 turnos, primero los urgentes y después los más cercanos»).
- **Cada turno es una fila suave** (una tecla blanca): la foto del local, el
  puesto, **el pago en grande a la derecha**, el local con la distancia,
  «+ propinas» si hay, y en el último renglón cuándo y cuánto dura, con la
  marca **«Urgente» al final**. Antes era una comanda de papel con el puesto
  en brocha y el sello de goma.
- **Sin foto va el cielo** (`PortadaCielo`) con el ícono del rubro. Se fue el
  marrón por rubro de esta pantalla.
- **Las acciones son las de siempre**, en un renglón: guardar, «Cómo llegar»,
  «Compartir» y «No, gracias» como botones redondos de 44 px (con su nombre
  para lectores de pantalla), y «Postularme». A 320 px «No, gracias» y
  «Postularme» bajan juntos a un segundo renglón.
- **Un solo ámbar:** «Postularme» va en ámbar en el primer turno de la lista
  y quieto (relleno suave, letra azul hondo) en los demás, como «Elegir» en
  Candidatos.
- **«Comercio verificado»** es el escudo al lado del nombre (con su nombre
  accesible), como en «Cerca tuyo» del Inicio; antes era un cartel con texto.
- En la compu los turnos van en dos columnas (antes tres): con tres, las
  acciones no entraban en un renglón.

Técnico: `frontend/app/buscar/page.tsx`;
`frontend/components/worker/OportunidadFila.tsx` (antes
`OportunidadComanda.tsx`, que sólo usaba esta pantalla); un bloque nuevo en
`frontend/app/globals.css` (`.chip-filtro`, `.chip-elegido`, `.fila-buscar*`),
sin tocar las reglas que ya estaban; `frontend/e2e/buscar-suave.spec.ts`
(antes `buscar-relieve.spec.ts`).

**Por qué así:**

- **Lo que en la maqueta es una función nueva no se agregó:** el buscador de
  texto (hoy `/buscar` no busca por texto), el conmutador lista/mapa, los
  chips «Hoy», «Mañana» y «Fin de semana» (hoy no se filtra por día) y la
  marca «Paga más» (hoy no hay una regla que diga qué turno paga más). Sin el
  buscador, lo que vive en el cielo son los rubros, que en la maqueta también
  son chips de vidrio.
- **El título sigue siendo «Buscar turnos»** y no «Turnos cerca», como en la
  maqueta: esta pantalla muestra todo el mercado, también lo que queda lejos.
- **Las acciones se quedaron en la fila.** La maqueta no las dibuja (la fila
  sólo abre el turno), pero sacarlas cambia lo que se puede hacer desde acá.
- **El ámbar en el primero** y no en todos (serían tantos ámbares como
  turnos) ni en ninguno (la pantalla se quedaba sin acción a la vista).
- **Los chips miden 44 px** (la maqueta, 40): es lo que se toca.

**Revisión independiente** (otro agente, intentando romperlo: de 320 a
1280 px, en claro y oscuro, datos difíciles, estados cargando, error y vacío,
contraste medido, teclado, letra al 200 % y «reducir movimiento»; comparó la
lógica con la de `main`). Aprobó con detalles y se arreglaron: con la letra al
200 % a 320 px «Postularme» se salía de la fila y «Recepcionista» se partía
(ahora el texto baja debajo de la foto y el puesto tiene tope); en la compu
los rubros que no entraban en el carril no se alcanzaban con el mouse (ahora
bajan de renglón; venía de antes); y «5 h» se partía en dos renglones. La
suite e2e completa encontró otro: el aire entre los botones de la fila no
abría el detalle (ahora sólo los botones reciben el toque). Cada arreglo
tiene su test en `buscar-suave.spec.ts`. Quedó sin tocar, por menor: con un
nombre de comercio larguísimo sin espacios, el escudo de «verificado» queda
solo en un renglón.

**Prueba en la app** (`tools/e2e-local`, backend real y datos sembrados):
una cuenta nueva de quien trabaja, en celular y compu, en claro y oscuro. Con
14 turnos reales: filtró por rubro (pidió `position=bartender`), por
«Urgentes» (6 filas, las 6 con la marca) y por «Mejores pagos»; guardó un
turno; descartó otro con «No, gracias»; se postuló (201, el toast, la fila
sale y el ámbar pasa al siguiente; la postulación quedó `pendiente` en la
base) y abrió el detalle tocando la fila. Sin errores de consola ni de red.

**Queda abierto:**

- Decidir con Julieta lo que quedó afuera (buscador de texto, lista/mapa,
  filtro por día, «Paga más») y si el ámbar va en el primero.
- De 640 a 767 px la pantalla es una columna de 448 px centrada, como las
  otras pantallas suaves; no usa el ancho disponible.
- En `globals.css` quedaron sin uso las reglas de `.comanda-oportunidad`; se
  borran en el cierre de la migración, con lo demás «con relieve».
- La fila de `OportunidadComanda` en la tabla de piezas de
  `design-system/direccion-relieve.md` quedó vieja (no se toca en la tanda;
  se corrige al cerrarla).
