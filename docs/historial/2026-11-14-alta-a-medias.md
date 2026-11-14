# G12: el alta que quedó a medias (U034, U035) (#578)

**Pedido:** salida a beta, grupo G12 (`docs/planning/BETA_DISENO_GRAVES.md`, decisión 9 del tablero). Si se corta la bienvenida, la cuenta queda sin perfil y nada guiaba a completarlo; el panel del comercio mostraba el error crudo del backend.

**Qué cambió:**
- Al ingresar (`/login` con contraseña o Google), si la cuenta de trabajador o comercio no tiene su perfil, va a `/bienvenida` conservando `next` (admin nunca). `login` y `loginWithGoogle` devuelven la sesión abierta (`SesionAbierta`) para decidirlo sin esperar al contexto; `lib/perfil-faltante.ts` hace la consulta (`GET /workers|companies/me/profile`: sólo el 404 cuenta, un error de red o un 500 no manda a nadie a la bienvenida). Reemplaza el desvío que G10 (#574) sacó del aviso «cuenta creada».
- Panel del comercio (`app/shifts/page.tsx`): un 400 de `GET /shifts/me` se confirma con `GET /companies/me/profile` (404) —no por el texto del mensaje— y entonces se muestra como «Te falta completar tu comercio» con su botón; se ocultan Publicar, Evento y el asistente.
- Inicio del trabajador (`app/feed/page.tsx`): perfil 404 → «Te falta completar tu perfil»; perfil sin zona (lat/lng) o sin oficios → cartel fijo «Completá tu zona y tus oficios para recibir turnos» que lleva a `/profile`. Ambos con `components/PerfilFaltanteCard.tsx`, sin cerrar. Cubre la decisión 9. Con el cartel a la vista el estado vacío no suma otro botón ámbar (su acción pasa a secundaria), y sin perfil el vacío no se muestra («No hay más turnos» sería falso).
- `/bienvenida` del comercio con el perfil ya creado (POST 409): «Omitir por ahora» no escribe nada; «Cargar la ubicación después» y «Terminar» hacen PUT sobre el perfil existente (conserva categoría, descripción, capacidad, horarios y lo que no se cargó). La cuenta invitada del comercio sigue reemplazándolo entero (`GUEST_EMPLOYER_EMAIL`).
- Tests: `e2e/alta-a-medias.spec.ts` (con las respuestas reales del backend) y `lib/perfil-faltante.test.ts`; `limite-de-intentos` y `volver-a-donde-iba` ahora mockean el perfil, porque el ingreso lo consulta.

**Por qué así:** el chequeo va en el ingreso y no en un guardia global de rutas, para no sumar un pedido a cada pantalla; quien ya tiene sesión y entra por otra ruta cae en los carteles. El cartel de zona/oficio apunta a `/profile` (el formulario conserva lo ya cargado) y no a `/bienvenida`, que pide zona y oficio otra vez.

**Queda abierto:** el mail de la decisión 9 a los 2 trabajadores de producción sin zona (operativo, de Julieta).
