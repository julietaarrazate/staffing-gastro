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

**Queda abierto (a confirmar por Julieta antes de publicar):**

- Los puestos del eyebrow ("Mozos, bartenders, cocina y más").
- La pregunta legal (monotributo, quién es el empleador): no se publica
  sin asesoría.
- El medio de pago que se recomienda (hoy sólo dice "directo, como
  acuerden").
- El texto sobre instalar Oído en iPhone para recibir avisos: la app no
  tiene todavía un aviso propio que guíe la instalación.
- Medir los botones: los `data-cta` están puestos, falta la herramienta de
  analítica.
