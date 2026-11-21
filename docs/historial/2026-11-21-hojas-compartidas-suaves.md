# Las hojas y ventanas compartidas con la dirección suave (#PR)

**Pedido:** Julieta, terminar de pasar la app a la dirección suave (ADR-0028).
Sólo la piel: qué abre cada cosa, qué hace cada botón, el foco, el arrastre,
`Escape`, los textos y la lógica no cambian.

**Qué cambió:** lo que ve la persona.
- **Hoja que sube** (`ui/Sheet`: «Más acciones», el detalle de un turno en
  `/map`, la lista de avisos del celular, el pedido de activar notificaciones):
  hoja blanca de esquinas grandes (28 px) con sombra difusa, manija suave,
  título en la letra de la app (negrita grande) y cruz de 44 px con el relleno
  del campo (antes 32 px). De noche, la noche azul de la app. El velo de atrás
  es de tinta azul y no negro puro.
- **Diálogo centrado** (`ui/Modal`: «Cancelar turno», «Marcar como pagado», «No
  se presentó», «¡Turno publicado!», los de Mi plan, Soporte y Administración):
  esquinas de 28 px y sombra difusa alta en lugar de los 8 px con sombra dura.
  Adentro, los botones son los suaves (el principal en ámbar degradé, sin el
  borde ni la sombra dura de `boton-relieve`) y el secundario («Volver», «Ahora
  no») va quieto, con el relleno del campo.
- **«¡Turno publicado!»**: un solo ámbar, «Ver mi turno». El círculo del paso 1
  pasa a azul hondo y la etiqueta «ahora» y el ícono de arriba a `chip-suave`
  (antes eran ámbar: tres ámbares en una ventana).
- **Menú «Más acciones»**: filas redondas de 48 px, sin rayas entre una y otra.
- **Avisos** (`NotificationBell`): una tarjeta por aviso, sin rayas; el que no
  se leyó, con el relleno del campo y un punto azul hondo (antes un celeste con
  borde de otro color). El desplegable de la barra de la compu, igual.
- **Aviso flotante** (`ui/Toast`): esquinas de 20 px (no una píldora que se
  deforma con dos renglones), sombra azul difusa; el de error pasa a
  `danger-strong` (la letra blanca daba 3,8 sobre `danger`; ahora 5,6).
- **Recorrido guiado** (`GuidedTour`): tarjeta suave, título en la letra de la
  app (antes serif), puntos y anillo en azul/blanco (antes ámbar, junto al botón
  ámbar), velo azul, cruz de 44 px.
- De paso: «¡Turno confirmado!» (Mis turnos) dibuja la copa en azul y no en
  ámbar; el recorte de foto (`ImageCropModal`) usa los botones suaves y el
  deslizador azul; «Comparar turnos guardados» y el nuevo ticket de Soporte
  (`select` y `textarea` con `campo`) dejan el filete.

**Cómo:** las capas se dibujan en un portal, fuera de la raíz de cada pantalla,
así que `.estilo-suave` de la pantalla no las alcanzaba (el mapa lo resolvía
poniendo la clase a mano adentro de la hoja). Ahora cada capa (`Sheet`, `Modal`,
`GuidedTour` y el desplegable de avisos) se lleva su propia `.estilo-suave
ventana-suave`: la piel suave no depende de la pantalla de atrás, y Administración
(que no la lleva) ya la tiene en sus diálogos. Clases nuevas al final de
`frontend/app/globals.css` (`.hoja-flotante`, `.manija-suave`, `.cruz-suave`,
`.dialogo-suave`, `.velo-suave`, `.fila-hoja`, `.aviso-fila`, `.aviso-flotante`,
`.recorrido-tarjeta`, `.paso-chapa`, `.chip-suave-chico`, `.panel-avisos`).
`Button variant="surface"` lleva el gancho `.boton-secundario`, que sólo pesa
adentro de `.ventana-suave`. Tests: `frontend/e2e/hojas-suaves.spec.ts` (sin
relieve, un solo ámbar, foco atrapado y visible, `Escape`, 320/390/1280, claro y
oscuro, letra al 200 %, «reducir movimiento»); los unitarios y los 248 e2e de las
pantallas que abren estas piezas siguen igual.

**Por qué así:** se descartó migrar `.boton`, `.campo` y los demás a `:root`
(cambiaría la landing y Administración de un golpe); envolver sólo las capas
compartidas llega a todo lo que se abre en un portal sin tocar lo demás. La
landing no usa `Sheet`, `Modal`, `Toast`, `NotificationBell` ni `GuidedTour`
(usa `ConfirmOverlay`, que no cambió, y sus propias réplicas).
`BottomSheet` (la bandeja de `/search`) ya tenía la piel suave (`.mapa-hoja`);
`ConfirmOverlay` (el tilde sobre una tarjeta) es plano y de tokens.

**Queda abierto:** los textos de cuerpo de los diálogos siguen en `text-ink/60`
(los escribe cada pantalla; cambiarlos a `ink-soft` es un barrido aparte). Las
confirmaciones que usan `primary` para algo irreversible («Sí, dar de baja» en
Mi plan) se dejaron como están: es una regla del producto, no de la piel. Al
terminar toda la migración, mover `.estilo-suave` a `:root` (lo dice el ADR) y
borrar estos envoltorios.
