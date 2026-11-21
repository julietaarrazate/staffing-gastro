# El acceso y la bienvenida con la dirección suave (#PR)

**Pedido:** Julieta, 2026-11-21: «cuando vas a ingresar o crear cuenta sigue con
la estética vieja». Sin maqueta: se armó con las piezas de Publicar turno y de
Editar perfil. Sólo la piel: la lógica de ingreso, Google, Turnstile, el
consentimiento legal obligatorio, los pasos de la bienvenida, las validaciones,
los `next`, los mensajes de error y todos los textos quedaron igual. No se
tocó el texto legal ni sus links, así que no se sube la versión legal.

**Qué cambió:** `/login`, `/register`, `/recuperar`, `/restablecer`,
`/verificar-email` y `/bienvenida`.

- **Arriba, el cielo** (con su nube; de noche, el cielo de noche con
  estrellas) con el «oído» plano del Inicio y el título en letra normal grande
  (antes, serif centrado sobre el lienzo). La bajada de cada pantalla pasó al
  cielo. **Debajo, la hoja** con el formulario; en la compu, angosta y centrada.
- **Campos suaves** (relleno, sin filete) y **un solo ámbar por pantalla**: la
  acción principal, ahora en el degradé suave (antes, con relieve azul). Los
  links secundarios, en el azul de los links. «Continuar con Google» sigue
  siendo el botón de Google (blanco, o negro de noche), sin tocarle colores.
- **`/register`:** el rol son dos teclas suaves con `aria-pressed` (la elegida
  en azul hondo; antes, pestañas con raya); el consentimiento, con la casilla
  suave (misma casilla nativa, redonda; mismo texto y mismos links).
- **`/bienvenida`:** el cielo lleva los pasos tachados y la pregunta del paso;
  la hoja, el paso. Los oficios son chips suaves con el elegido en azul hondo
  (antes, azul hondo recto). «Dejar para después», «Omitir por ahora» y
  «Volver» van como texto quieto. El círculo de foto (`SinFoto`) no cambió.
- **«Explorar sin cuenta»** (PIN, apagado en la beta) y el paso del rol de
  Google: cajas suaves con botones quietos (sin segundo ámbar).

Técnico: `frontend/components/acceso/PantallaAcceso.tsx` (cáscara) y
`AceptoTerminos.tsx` (casilla, antes duplicada en `/register` y en
`GoogleAuthButton`); las seis páginas; `components/Navbar.tsx`; un bloque
nuevo al final de `app/globals.css` (`.casilla-nativa`, autocompletado,
campo en caja suave); `e2e/acceso-suave.spec.ts`. La landing no se tocó.

**Decisiones fuera del brief:**

- **Sin sesión, estas pantallas no llevan el encabezado** (el «oído» del cielo
  lleva al inicio) y `Navbar` marca `data-cromo="app"` para que la zona segura
  de arriba (notch) se pinte con el color del cielo. Se pierden los links
  «Ingresar / Crear cuenta» de arriba, que las pantallas ya traen en el cuerpo.
  Con sesión (confirmar el email estando adentro) queda la barra de siempre.
- **El autocompletado de Chrome** (fondo amarillo) se cubre con el relleno del
  campo para todo `.estilo-suave .campo`, no sólo acá (no se pudo disparar el
  autocompletado real en el navegador de pruebas).
- La `Link` de «Volver…» y los de abajo ganaron 44 px de alto táctil.

**Queda abierto:** Turnstile con clave real no se vio renderizado (los e2e no
lo simulan); el widget es de Cloudflare, `size: flexible` dentro de la hoja.
