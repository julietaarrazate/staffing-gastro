# Landing corta: qué hace Oído en la primera pantalla y un lugar para quien trabaja

**Pedido:** Julieta, 2026-10-12: "no termina de entenderse qué hace Oído",
no convierte ni a comercios ni a trabajadores, las animaciones están muy
rápidas, hay títulos innecesarios y confusos, todos terminan en punto. Leyó
la auditoría de la landing (estructura propuesta en 10 bloques) y eligió
"la versión corta". Va encima de los títulos en Bricolage (#425).

**Qué ve el usuario:**

1. **Hero:** "¿Se te cayó alguien para hoy? Cubrí el turno en minutos", la
   bajada con qué hace y "Sin comisión por turno", el botón "Publicar un
   turno gratis" y un link propio para quien trabaja. Al lado (abajo en el
   celular), Martín avisa a las 20:46 que no llega y a las 20:54 el turno
   está cubierto.
2. **Así se cubre un turno:** tres pasos con título (`h3`) que no cambia:
   "Contalo como lo dirías", "Le llega a quien está cerca" (los 10 más
   indicados; a los 8 minutos pasa a urgente), "Elegís y te confirma".
   Cierra la banda ámbar "¡Oído!" con el objetivo de los 10 minutos y la
   única aclaración de que los nombres y horarios son de ejemplo.
3. **Sabés quién entra a tu salón:** la ficha de Lucía y cuatro reglas.
4. **Empezás gratis, sin comisión por turno:** las tres tarjetas de precios.
5. **Para trabajar** (`#trabajar`, también en el encabezado): qué gana,
   cómo empezar en tres pasos y "Crear mi perfil gratis".
6. **Preguntas frecuentes**, que se abren sin JavaScript.
7. **Cierre** "La próxima vez que se te caiga un turno, pedilo por Oído" y
   el pie, con link a las preguntas.

Ningún título termina en punto. El encabezado es siempre claro (en
escritorio arrancaba oscuro encima del hero claro) y su botón "Pedir
personal" aparece al pasar el del hero y no se vuelve a esconder. La letra
chica que importa pasó de 11 px a 13 px. En la landing se puede agrandar con
dos dedos.

**Qué cambió (técnico):**

- `frontend/components/landing/`: la composición nueva (`LandingCorta.tsx`)
  y una sección por archivo (`Hero`, `ComoFunciona`, `Confianza`,
  `Precios`, `ParaTrabajar`, `Preguntas`, `Cierre`). Se reusan de la
  historia, simplificadas y quietas: `replicas.tsx`, `fixtures.ts`,
  `RelojDelTurno.tsx`, `useStoryShift.ts`, el encabezado y el pie. Se borró
  `components/landing/story/` (escenas, motor `useStage` y su test).
- `Reveal.tsx` + `.landing-reveal` en `globals.css`: la única animación de
  scroll, una vez y lenta. Se borraron las animaciones CSS que ya no se usan
  (`storyTyping`, `storyRing`, el cursor, los puntos guía, `--svh-estado`).
- `app/page.tsx` pasa a componente de servidor: URL canónica, datos
  estructurados `Organization` y `FAQPage` (de la misma lista que la
  sección, `components/landing/preguntas.ts`) y un `viewport` propio que
  permite el zoom. La redirección con sesión se mudó a
  `components/landing/LandingGate.tsx`.
- `OpportunityCard` y `CandidateCard` aceptan `preview`: el puesto va como
  texto y no como `h2`, y sin links a `/companies/historia` ni
  `/workers/lucia`, que no existen. Fuera de la landing nada cambia.
- `components/landing/planes.ts`: el respaldo de precios, ahora compartido
  por los precios y las preguntas.
- `e2e/landing.spec.ts` reescrito: hero y caminos al alta, títulos sin
  punto y pasos `h3`, ancla `#trabajar` y botón del encabezado, preguntas
  iguales en la página y en los datos estructurados, canónica, y "reducir
  movimiento" con todo a la vista.

**Por qué así:**

- El zoom se habilita sólo en la landing: el layout lo bloquea para la app
  porque sus campos usan 14 px y en iPhone harían zoom solos al enfocarlos.
  Habilitarlo en toda la app pide antes llevar los campos a 16 px.
- Las imágenes del producto son piezas reales dentro de `inert` y
  `aria-hidden`: el texto de al lado ya dice lo mismo.
- En el celular se esconden las imágenes que repiten el texto (la tarjeta
  del paso 1, los otros dos postulantes, el celular de Lucía): la página
  mide 10,8 pantallas en un celular de 390 × 844 y 8,3 en una compu de
  1440 × 900. La meta de la auditoría era 7 a 9 en el celular; lo que más
  pesa ahora son las tres tarjetas de precios apiladas.
- No va la sección de prueba con números (turnos cubiertos, minutos de
  mediana, locales): todavía no hay datos reales y no se inventan.

## Segunda vuelta, el mismo día

**Pedido:** Julieta vio la vista previa. Le gustó que sea breve, pero pidió:
- algo de animación en lo que quedó;
- sacar el eyebrow ("Beta en CABA…") y la bajada del hero, que repetía lo
  mismo;
- que quien entre por primera vez se baje Oído al celular, en Android y en
  iPhone, sin tecnicismos (mejor instalada y con los avisos prendidos);
- un inicio pensado para captar clientes y cerrar leads.

**Qué cambió:**

- **Hero:** el título y el botón. Abajo, "Gratis para empezar · Sin
  comisión por turno". La imagen se arma en orden: la burbuja, "sin
  cubrir", la línea que se dibuja, "cubierto" y la confirmación de Lucía.
- **Animaciones**, una vez y al aparecer (`.anim-*` en `globals.css`, que
  corren dentro de un `Reveal`):
  - la frase del paso 1 se escribe sola y marca sus tres partes;
  - en el mapa se publica el pin, salen las ondas y a cada persona le llega
    el aviso según su distancia;
  - los postulantes suben;
  - "¡Oído!" entra con rebote;
  - los cupos de turnos de cada plan se llenan de a uno;
  - la notificación cae en el celular.
- **"Llevá Oído en tu celular"** (`InstalarApp.tsx`, después de "¡Oído!"):
  - en Android, el botón "Instalar Oído" abre la ventana del navegador; si
    el navegador no la ofrece, se muestran los dos toques del menú;
  - en iPhone: Compartir → Agregar a inicio, con los íconos;
  - en la compu, que la abran desde el celular;
  - ya instalada, la sección no aparece.
  La lógica está en `lib/instalar.ts`. El aviso de Android se atrapa con un
  script en línea (`lib/instalar-script.ts`) aunque llegue antes de que
  cargue la página.
- **Barra fija abajo en el celular** (`BarraCelular.tsx`): "Publicar un
  turno gratis" + "Instalar". Aparece al pasar el hero y se va en el cierre.
  En el celular reemplaza al botón del encabezado.
- **Abierta desde el ícono y sin sesión:** va a `/login` y no a la landing
  (`LandingGate.tsx`).
- La pregunta "¿Tengo que bajar una app?" pasa a "¿Cómo la bajo al
  celular?".

**Por qué así:**

- Los avisos no se piden desde la landing: no hay sesión para guardarlos, y
  la regla es pedirlos después de una acción que importa
  (`lib/push-prompt-context.tsx`). La landing explica que se activan al
  publicar o postularse.
- Ninguna animación es un bucle ni reemplaza texto. Con "reducir
  movimiento" o sin JavaScript todo queda quieto y visible.

**Medidas (segunda vuelta):** con la sección nueva, la página medía 11,4 pantallas en un
celular de 390 × 844 y 9,1 en una compu de 1440 × 900.

## Tercera vuelta

**Pedido:**
- el título dice "¿Faltó alguien de tu equipo?";
- fuera los textos debajo de los títulos que repiten lo que muestran las
  animaciones;
- la instalación tiene que mostrar Android y iPhone, nombrando Chrome y
  Safari;
- la instalación va al final, para no cortar lo que cuenta la página;
- "verificada" sin "por una persona";
- mejores animaciones.

**Qué cambió:**

- **Hero:** "¿Faltó alguien de tu equipo? Cubrí el turno en minutos".
- **Pasos sin bajada.** Cada paso tiene una descripción oculta para
  lectores de pantalla (`alt` de `Paso`) y la imagen cuenta más:
  - **Paso 1:** la frase se escribe y salen tres fichas (Puesto, Horario,
    Pago).
  - **Paso 2:** el reloj dice "Avisado a 10" mientras corre el aviso;
    después tres pines pasan a ámbar con su puntaje y el reloj dice
    "3 postulantes".
  - **Paso 3:** al final aparece "Lucía confirmó · 20:54".
- **Se fueron otras bajadas:** la de precios y la de instalar.
- **"Llevá Oído en tu celular"** va entre las preguntas y el cierre.
  Muestra siempre "Android · desde Chrome" e "iPhone · desde Safari",
  primero el del aparato que mira. En Android, si el navegador lo ofrece,
  el primer paso es el botón "Instalar Oído".
- **"Verificada":** la regla de confianza dice "Identidad verificada con
  DNI y selfie" y la pregunta frecuente dice "Verificamos…".

## Quinta vuelta (2026-10-13): animaciones de la original y menos texto

**Pedido:** que no esté sobrecargada como la original ni quede plana, con
animaciones lentas que se lean. Además, sacar textos que sobran, sumar
"Crear cuenta" y pasar instalar a las preguntas frecuentes.

**Qué cambió:**

- **Hero:** vuelve la animación original de la noche (`HeroNoche.tsx`), ahora
  por tiempo y no por scroll, unos 8 s en total:
  1. Martín escribe con los puntitos.
  2. Llega "Perdón, hoy no llego." y la burbuja se sacude.
  3. El mensaje se condensa en "20:46 · sin cubrir".
  4. La línea baja hasta "20:54 · cubierto" y aparece "Lucía confirmó".

  Un script en `app/page.tsx` marca `landing-js` antes de pintar, para que
  no titile. Detrás del título va el brillo ámbar de crear cuenta (`--wash`).
  Se sacó "Gratis para empezar · Sin comisión por turno".
- **Paso 1:** vuelve el cuadro "Describilo" original:
  1. la frase se escribe con el cursor;
  2. se marcan sus tres partes;
  3. se aprieta "Completar";
  4. aparece "Leyendo tu pedido…";
  5. sube la tarjeta del turno, también en el celular.
- **Paso 2:** el mapa original:
  1. las calles aparecen en un círculo desde el local;
  2. cae el pin del turno;
  3. salen las ondas y se encienden los avisados según la distancia;
  4. tres pasan a postulantes.

  Arranca cuando el mapa está un tercio adentro de la pantalla
  (`Reveal margen`), para no correr mientras se mira el paso 1.
- **Títulos de los pasos:** un escalón más chicos que "Así se cubre un
  turno" y con el número en un círculo ámbar. Antes se leían como dos
  bloques iguales pegados.
- **Textos que se fueron:**
  - "Martín, Lucía, Tu bar… son de ejemplo";
  - "Para trabajar no se paga nada · Ver cómo funciona para vos";
  - la regla de confianza queda en "Identidad verificada".
- **Instalar:** se fue la sección "Llevá Oído en tu celular". Sus pasos
  (Chrome y Safari, y el botón de Android) viven dentro de la pregunta
  "¿Cómo la bajo al celular?" (`InstalarPasos.tsx`, ancla `#instalar`).
- **Encabezado:** esmerilado, con "Ingresar" y **"Crear cuenta"** (`/register`)
  siempre a la vista.
- **Barra del celular:** vidrio esmerilado con un solo botón a lo ancho. El
  ícono de instalar aparece sólo en Android, cuando el navegador ofrece
  instalar directo.

## La historia queda en /historia

**Pedido:** Julieta quiere guardar la landing anterior. Sus animaciones
explican mejor y sirven para reels, historias de Instagram y publicidad. La
landing corta queda como borrador hasta que la convenza.

**Qué cambió:**
- `components/landing/story/` vuelve tal cual estaba, con los títulos en
  Bricolage de #425.
- Se publica en `app/historia/page.tsx`. No se indexa (`robots: noindex`),
  no está en el sitemap y su canónica es `/`.
- `Navbar` y `BottomNav` no se muestran en `/historia`, así no aparecen en
  una grabación con la sesión iniciada.
- Vuelven a `globals.css`, en su propio bloque, los estilos que sólo usa la
  historia.
- Test en `e2e/landing.spec.ts`: la recorre entera sin errores y comprueba
  el `noindex`.

**Por qué así:** con una ruta propia se puede grabar desde el celular
cuando haga falta, sin depender de recuperar código viejo de git. La
contra: hay dos encabezados y dos pies parecidos (los de `story/` y los de
la landing corta). Se acepta mientras la historia sea material para redes.

## Sexta vuelta (2026-10-13): textos y la noche a pantalla completa

- **Botones del inicio:** "Necesito personal" (ámbar) y "Quiero trabajar"
  (con borde), como en la original. Cada visitante se reconoce en uno; "Publicar
  un turno gratis" pedía entender qué es publicar un turno y el "gratis"
  chocaba con los planes pagos. El encabezado y la barra del celular dicen
  "Necesito personal"; el cierre y el final de los pasos, "Publicar mi primer
  turno gratis", porque ahí ya se entendió de qué se trata.
- **Cierre:** "La próxima vez que falte alguien, cubrilo con Oído" (retoma la
  pregunta del inicio).
- **Textos:** sin "Estamos en beta" en zonas; "Le pagás vos directo, como
  acuerden"; "Reseñas solo de turnos hechos en Oído" (había dos "solo");
  "solo" sin tilde en lo visible; "mozo/a" en minúscula en el aviso.
- **La noche del hero en el celular:** quedaba debajo del inicio y la animación
  arrancaba al cargar, así que se veía por la mitad o ya terminada. Ahora ocupa
  la pantalla entera (menos el encabezado) y arranca cuando se ve casi
  completa (IntersectionObserver al 75 %). En escritorio no cambia: está al
  lado del título y arranca enseguida.

## Séptima vuelta (2026-10-13): título que convierte y la noche original

- **Título:** "¿Faltó alguien de tu equipo? Conseguí un reemplazo en
  minutos". "Reemplazo" nombra lo que el comercio necesita en ese momento
  ("turno" es palabra de la app); "conseguí" es lo que Oído hace por él.
- **Bajada nueva, que no repite el título:** "Mozos, bartenders y cocina con
  identidad verificada, cerca de tu local." Dice qué es Oído y a quién te
  consigue, para entenderlo en la primera pantalla.
- **Botones en el celular:** centrados, del mismo ancho y más bajos (48 px);
  lado a lado desde 400 px, uno abajo del otro en pantallas angostas, con
  tope de ancho en tablet. En computadora siguen a la izquierda.
- **La noche, como la original:** "Viernes · salón lleno" y la hora grande
  20:46; Martín escribiendo un buen rato (~3 s) antes de "Perdón, hoy no
  llego."; la narración "Arrancás a las 21. Y te escribe el mozo."; después
  sin cubrir → cubierto, la hora grande pasa a 20:54 y Lucía confirma. Unos
  11 s en total.

## Octava vuelta (2026-10-13): vuelve la noche atada al scroll

- **Hero a la izquierda** otra vez (Julieta: "quedaba mejor a la izquierda que
  centrado"); los botones conservan el mismo ancho en el celular.
- **La noche es la de la historia original, con scroll** (Julieta: "estaba
  mejor con el scroll, el original sigue teniendo mejor efecto"; la versión
  por tiempo se sentía trabada). Se reusa `story/ActoNoche` con dos props
  nuevas: `copy` (el texto del hero corto) y `final="ticket"`: como la landing
  corta no tiene el reloj fijo del encabezado, la burbuja se condensa en el
  ticket "20:46 · sin cubrir" en el medio de la pantalla, puente a "Así se
  cubre un turno". /historia no cambia (valores por defecto). El escenario
  lleva el brillo ámbar de arriba. Sin JavaScript o con "reducir movimiento"
  sigue la versión quieta (texto + HeroNoche resuelta).
- **Botón del encabezado y barra del celular:** `useHeroAtras` mide el botón
  del hero en cada scroll en vez de observarlo una vez, porque el hero se
  reemplaza después de montar y el IntersectionObserver quedaba mirando el
  nodo viejo. Mientras la noche está fijada, aparecen al terminar la escena.
- **Pasos:** paso 1 "Pedí lo que necesitás" (antes "Contalo como lo
  dirías"); paso 2 "Buscamos quién lo cubra, cerca tuyo" (antes "Le llega a
  quien está cerca").

**Queda abierto (a confirmar por Julieta antes de publicar):**

- La pregunta legal (monotributo, quién es el empleador): no se publica
  sin asesoría.
- El medio de pago que se recomienda (hoy solo dice "le pagás vos directo,
  como acuerden").
- Probar la instalación en un Android y un iPhone reales: los tests simulan
  el aviso del navegador. En Chrome de Android el botón necesita que el
  navegador considere instalable el sitio.
- Medir los botones: los `data-cta` están puestos, falta la herramienta de
  analítica.
