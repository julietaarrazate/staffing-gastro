# Editar perfil y Ajustes con la dirección suave (#PR)

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
bienvenida no cambia. **Sí cambia, apenas, «Publicar evento»**, que ya era
suave y usa el mismo selector de zona: sus dos desplegables pasan a verse
como los demás campos de esa pantalla (relleno, sin filete).

**Por qué así:**

- **Azul hondo para lo elegido** (habilidades, apariencia), como los chips de
  Buscar y los puestos de Publicar: el ámbar es de la acción de la pantalla.
- **El formulario del comercio no se rediseñó:** su pantalla de Perfil sigue
  en la versión de antes y no tiene maqueta. Se migró lo que comparte con el
  de quien trabaja (la cáscara, los campos, el botón) para que la pantalla no
  quede mitad y mitad.
- **«Guardar cambios» sigue al final del formulario**, no fijo abajo: fijarlo
  cambia cómo se usa la pantalla.

**Queda abierto:**

- En «Datos del comercio», el recuadro del mapa de la dirección, el buscador
  de direcciones y las dos fotos (`MapAddressPicker`, las subidas) siguen con
  el aspecto de antes; van con el Perfil del comercio.
- «Usar mi ubicación actual» es el botón liso de siempre (blanco con filete).
- `SubpageHeader`, `Row`, `RowGroup` y `SectionLabel` de `ProfileParts` quedan
  para el Perfil del comercio y del admin; se borran cuando esas pantallas se
  migren.
