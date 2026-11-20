# Editar perfil y Ajustes con la dirección suave (#711)

**Pedido:** Julieta, 2026-11-20, con una captura de su celular: «para editar
el perfil sigue versión vieja». El Perfil de quien trabaja ya era suave (#705)
y desde ahí se caía en dos pantallas de antes. No tienen maqueta en el lienzo:
se armaron con las piezas de Publicar turno (#682) y del Perfil. Sólo la piel.

**Qué cambió:** `/profile/edit` (quien trabaja y el comercio) y
`/profile/settings` (los tres roles). Qué se carga, qué se valida, qué se
guarda y a dónde lleva cada cosa quedó igual.

- **Arriba, el cielo corto y liso** con la vuelta al perfil en un botón
  redondo de vidrio (antes, el link «‹ Perfil») y el título grande en letra
  normal («Editar perfil», «Datos del comercio», «Ajustes»; antes, en serif).
- **Debajo, la hoja** con el formulario directo encima (antes, una tarjeta
  con filete sobre el lienzo).
- **Editar perfil:** las habilidades son chips suaves de 44 px y **las
  elegidas van en azul hondo** (antes, ámbar): el único ámbar es «Guardar
  cambios». Los nombres de los grupos van sin el ícono de color. Los
  desplegables de provincia y barrio, «Sobre mí» y el CV usan el relleno del
  campo, sin filete.
- **Ajustes:** «Apariencia» y «Cuenta» como títulos de sección; la apariencia
  es una pista con la elegida en azul hondo (antes, ámbar); las
  notificaciones, Soporte, la verificación en dos pasos (admin) y «Cerrar
  sesión» son filas suaves, sin íconos de colores. En esta pantalla no hay
  ámbar: no tiene una acción principal.
- **Datos del comercio:** la misma cáscara; los campos y el botón se ven
  suaves, y «Ubicación del comercio» va sin el ícono de color.

Técnico: `SubpaginaSuave` en `frontend/components/profile/ProfileParts.tsx`
(la cáscara de las dos pantallas; `SubpageHeader` quedó sin uso);
`app/profile/edit/page.tsx`, `app/profile/settings/page.tsx`;
`components/WorkerProfileForm.tsx`, `components/AppearanceControl.tsx` y
`components/PushToggle.tsx` (los tres se usan sólo acá); un bloque nuevo al
final de `app/globals.css` (`.cv-soltar`, `.apariencia`);
`e2e/editar-perfil-suave.spec.ts`.

**Piezas compartidas:** `components/LocationPicker.tsx` (los dos
desplegables) y `components/CvUpload.tsx` recibieron sólo nombres de clase
(`campo`, `cv-soltar`), que fuera de `.estilo-suave` no hacen nada: la
bienvenida no cambia (verificado renderizado). **Sí cambian, apenas,
«Publicar turno» (el paso de la zona) y «Publicar evento»**, que ya eran
suaves y usan el mismo selector de zona: sus dos desplegables pasan a verse
como los demás campos de esas pantallas (relleno, sin filete).

**Por qué así:**

- **Azul hondo para lo elegido** (habilidades, apariencia), como los chips de
  Buscar y los puestos de Publicar: el ámbar es de la acción de la pantalla.
- **El formulario del comercio no se rediseñó:** su pantalla de Perfil sigue
  en la versión de antes y no tiene maqueta. Se migró lo que comparte con el
  de quien trabaja (la cáscara, los campos, el botón) para que la pantalla no
  quede mitad y mitad.
- **«Guardar cambios» sigue al final del formulario**, no fijo abajo: fijarlo
  cambia cómo se usa la pantalla.

**Revisión independiente** (otro agente, intentando romperlo: de 320 a
1280 px, claro y oscuro, los tres roles, datos difíciles, los estados de las
notificaciones, contraste medido, teclado, letra al 200 %, la bienvenida y
las dos pantallas de Publicar renderizadas, y la lógica comparada con la de
`main`). Aprobó con detalles y se arreglaron: el foco por teclado de las
filas de Ajustes se veía recortado (ahora va hacia adentro, también en el
Perfil); el texto y el ícono de la caja del CV daban 2,6 de contraste (van en
`ink-soft`); al arrastrar un archivo sobre la caja ya no se notaba; y un error
del servidor con una palabra larguísima desbordaba (venía de antes).

**Prueba en la app** (`tools/e2e-local`, backend real): dos cuentas nuevas de
quien trabaja (celular claro y compu oscuro) y una de comercio. Eligió una
habilidad, escribió «Sobre mí» e idiomas y guardó (PUT 200, «Perfil guardado»,
los datos quedaron en la base); volvió al Perfil con el botón de vidrio;
cambió la apariencia (cambia el tema); entró a Soporte; cerró sesión. El
comercio cambió su nombre y guardó (PUT 200). Sin errores de consola ni de red.

**Queda abierto:**

- La fila del CV ya subido («Reemplazar» mide 32 px de alto y el tacho 16):
  venía de antes; con la letra al 200 % a 320 px el nombre del archivo
  desaparece.

- En «Datos del comercio», el recuadro del mapa de la dirección, el buscador
  de direcciones y las dos fotos (`MapAddressPicker`, las subidas) siguen con
  el aspecto de antes; van con el Perfil del comercio.
- «Usar mi ubicación actual» es el botón liso de siempre (blanco con filete).
- `SubpageHeader`, `Row`, `RowGroup` y `SectionLabel` de `ProfileParts` quedan
  para el Perfil del comercio y del admin; se borran cuando esas pantallas se
  migren.
