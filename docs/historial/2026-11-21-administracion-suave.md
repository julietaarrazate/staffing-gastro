# La Administración con la dirección suave (#725)

**Pedido:** Julieta, 2026-11-20: «toda la app pasa a la misma dirección, el
admin también». Sólo la piel: los datos, los permisos, las acciones de
moderación (suspender, reactivar, «Cerrar turno», verificar DNI y constancia,
compromiso de pago, «Ver como»), la verificación en dos pasos, los textos y la
lógica quedaron como estaban.

**Decisión de diseño (quien coordina): el cielo corto y liso, no el alto.** El
admin es una herramienta de trabajo con tablas y listas densas, así que no
lleva el cielo alto de las pantallas de la app. Lleva el cielo corto y liso de
las subpantallas (como `SubpaginaSuave`: el título en `titulo-pantalla` sobre
el cielo, sin nubes grandes) y debajo la hoja con el contenido. En la compu la
hoja mide hasta 72 rem (antes, 64) para que las listas y las tablas
aprovechen el ancho. El logo y la campanita de arriba siguen como en #712.

**Qué cambió**

- **Una sola cáscara para todo `/admin/*`:** `components/admin/PantallaAdmin.tsx`,
  que arma `app/admin/layout.tsx`. Cielo corto con «Administración» y el
  título de la pantalla, y la hoja con el menú del panel adentro. Cada
  pantalla dice su título con `AdminHeading`, que ya no dibuja nada: se lo
  cuenta a la cáscara (contexto + `useLayoutEffect`); si una pantalla no lo
  dice (cargando la ficha), el cielo lleva el nombre de la sección. La ficha de
  una persona pone el nombre en el cielo, el email de bajada y la vuelta a
  Personas como botón de vidrio.
- **Menú:** en el celular, chips en una tira que scrollea; en la compu, una
  columna a la izquierda. La sección activa va en azul hondo (`.admin-nav-item`),
  los contadores en su tinte rojo. Mismo árbol con o sin menú: la admin con el
  alta de dos pasos pendiente sigue viendo sólo `/admin/seguridad`.
- **Tarjetas** `.tarjeta-suave` (todas las `Card` del admin), filas de listas
  como `.perfil-filas` (Personas, turnos y tickets de la ficha, encuesta),
  filtros y estados como `chip-suave chip-filtro` con el elegido en azul
  hondo, campos `.campo` (buscador, barrio, notas, compromiso de pago, el
  código a mano), la caja de la vista previa de la suspensión y los códigos de
  recuperación como `.caja-suave`.
- **Botones:** el principal sigue ámbar (un solo ámbar por pantalla, p. ej.
  «Traer comercios del barrio»); los secundarios (`variant="surface"`) pasan a
  quietos por una regla bajo `.admin-suave`; suspender y los destructivos, en
  rojo; «Borrar contacto» de la encuesta pasó de `dark` a `danger`.
- Textos de apoyo al token `ink-soft` (antes `ink/40…70`, que daba poco
  contraste); sin letra serif/brocha ni mono en las etiquetas de sección.
- **Perfil del admin** (`app/profile/page.tsx`): la misma cáscara, con el
  cielo corto, la tarjeta del nombre (con `Avatar cielo`) y «Ajustes» como fila
  suave.
- Tres desbordes que aparecieron al probar a 320 px y con la letra al 200 %,
  todos de antes: la tarjeta de un comercio con nombre larguísimo en Crecimiento,
  «Altas por origen» sin scroll propio, y los títulos de la tira «Semana por
  semana» y de las tarjetas de números (`min-w-0`, `break-words`, `flex-wrap`).

**Por qué así:** un cielo alto en una pantalla que se usa para revisar listas
come el alto útil; el corto conserva el lenguaje (cielo, hoja, título grande)
sin eso. Una cáscara en el layout evita repetir el encabezado en diez
pantallas. Se reusaron los componentes (`Card` → clase, `Button`, `Badge`,
`SegmentedControl`) y las clases de las demás pantallas suaves; el CSS nuevo
son unas 70 líneas al final de `globals.css` bajo `.estilo-suave`. Las
pestañas «raya» de `SegmentedControl` (Soporte, Crecimiento, Métricas, En vivo)
quedaron como están: son el componente compartido de ADR-0027.

**Pruebas:** `e2e/admin-suave.spec.ts` (24: la cáscara en las diez rutas en
claro y oscuro, sin relieve, a lo sumo un ámbar, sin scroll horizontal a 390,
a 320 y con la letra al 200 %, el ancho en la compu, la vuelta de la ficha y el
perfil del admin). Los specs de lógica del admin no se tocaron.

**Queda abierto:** «Ver como» entra como la otra persona (deja de ser admin),
así que no hay una pantalla de admin con el modo activo que mirar; sólo se
probó que el flujo sigue. `Row`/`RowGroup` de `ProfileParts.tsx` quedaron sin
uso. Los estados de error y de carga se miraron sólo en claro y por código; el vacío de Personas, en claro y a 390.
