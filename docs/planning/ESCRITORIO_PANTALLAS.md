# Versión de escritorio: qué pantalla está hecha y cuál falta

**Decisión de Julieta (2026-11-24): adaptar todas las pantallas a compu, de los dos lados (opción B).**
Hoy casi todas son una columna de celular centrada (`max-w-md`, unos 450 px) y en la compu se ven
como un celular en el medio; ya se acomodan Chats (lista y conversación lado a lado) y algunas de la
admin.

**Cómo se trabaja:** una pantalla (o un grupo chico) por PR; el PR edita **sólo su renglón** acá
(para que sesiones en paralelo no choquen). Reglas:

- **El celular no cambia.** Todo va detrás de `md:` / `lg:` de Tailwind; las capturas de cada PR
  muestran celular (390 px) y compu (1440 px), en `data-theme="light"` y `"dark"`.
- **Aprovechar el ancho, no estirar:** dos columnas donde hay lista y detalle (Candidatos con la
  ficha al lado, Mis turnos con el turno elegido, Buscar con el mapa), grillas para tarjetas,
  formularios con ancho de lectura (~640 px) y la barra de abajo pasa a lateral o arriba en compu
  (una sola decisión para toda la app, en el primer PR, con ADR corto si cambia la navegación).
- Dirección suave (ADR-0028), tokens de `globals.css`, un solo acento ámbar por pantalla.

**Orden:** primero el acceso (renglón 18, adelantado por Julieta el 2026-11-24: es lo primero que ve
cualquiera), después lo del comercio (es quien más usa la compu), quien trabaja, lo público y la admin.

| # | Pantalla | Ruta | Lado | Estado |
|---|---|---|---|---|
| 0 | Navegación en compu (barra lateral o de arriba) y el marco común | `components/Navbar.tsx` (`BarraConSesion`, `.barra-compu`), `--app-frame` | los dos | ✅ ya existía (mirado a 1440 px el 2026-11-24): barra de arriba con las pestañas, la campanita y «Publicar turno», y el marco de 1024 px con su test (`e2e/anchos-de-contenedor.spec.ts`). Lo que falta es aprovechar el ancho adentro de cada pantalla |
| 1 | Panel del comercio | `shifts` | comercio | 🔵 ya traía grilla en compu; desde el 2026-11-24 los turnos van de a dos por fila como mucho (con tres, en el marco de 1024 px, el horario se partía), «Evento» junto a «Marchando» y el Panel vacío con los tres pasos en fila (`app/shifts/page.tsx`, `employer/CieloPanel`) |
| 2 | Candidatos, con la ficha al lado | `shifts/[id]/candidates` | comercio | 🔵 desde `lg`: la lista (todos en filas) a la izquierda y la ficha de la persona elegida a la derecha, con «Elegir a <nombre>» como único ámbar (`app/shifts/[id]/candidates/page.tsx`, `candidate/FichaCandidato`, `profile/FichaTrabajadorContenido`, `lib/use-es-compu.ts`) |
| 3 | Publicar turno y publicar evento | `shifts/new`, `shifts/new-event` | comercio | 🔵 «Publicar turno» ya tenía el formulario a la izquierda (ancho de lectura, ~575 px) y la vista previa a la derecha; se quitó la tarjeta repetida del último paso en compu. «Publicar evento» pasa a formulario + «Resumen» a la derecha (nombre, cuándo, zona, puestos, personas y total a pagar) y el botón de la confirmación deja de ocupar 480 px |
| 4 | Buscar y Mapa del comercio | `search` (el comercio no usa `buscar` ni `map`: busca personal en `/search`) | comercio | 🔵 mirado a 1440 px ya estaba bien: panel de 400 px con la lista a la izquierda y el mapa ocupando el resto (`app/search/page.tsx`); sin cambios, sólo prueba de la disposición en `e2e/buscar-comercio-suave.spec.ts` |
| 5 | Mis turnos del comercio | `my-shifts` | comercio | 🔵 `/my-shifts` es sólo de quien trabaja (`useRequireAuth({ roles: ["worker"] })`; al comercio lo manda a `/shifts`): lo suyo es el Panel (renglón 1), con su misma tira de días y «Más adelante». Nada propio que adaptar |
| 6 | Mi plan | `subscription` | comercio | 🔵 mirado a 1440 px el 2026-11-24: ya estaba bien (los tres planes lado a lado desde `lg`, marco de 1024 px); sin cambios de código, con test de la disposición (`e2e/mi-plan-suave.spec.ts`) |
| 7 | Perfil del comercio y ficha pública | `profile`, `companies/[id]` | comercio | 🔵 mirado a 1440 px: las dos ya iban en dos columnas dentro del marco (reputación y reseñas / accesos; datos / mapa), no se tocaron; sólo se les agregó la prueba de disposición (`e2e/perfil-comercio-suave.spec.ts`, `e2e/fichas-suaves.spec.ts`) |
| 8 | Favoritos | `favorites` | comercio | 🔵 mirado a 1440 px el 2026-11-24: ya estaba bien (grilla de dos columnas desde `lg`); sin cambios de código, con test de la disposición (`e2e/favoritos-soporte-suave.spec.ts`) |
| 9 | Inicio de quien trabaja | `feed` (trabajador) | trabajador | 🔵 ya traía la grilla de tarjetas en compu; desde el 2026-11-24 «Urgentes» es una grilla (2 por fila en tablet, 4 en el marco de 1024 px, sin carril ni media pantalla vacía), la grilla lleva su título «Para vos» con la cuenta y las tarjetas bajan de 620 a 560 px de alto y sólo la primera lleva «Postularme» en ámbar (las demás, azul hondo; ninguna si el cielo ya trae su ámbar) (`worker/OpportunityCard` prop `acento`, `app/feed/page.tsx`, `.urgentes-carril` en `globals.css`). El celular no cambia |
| 10 | Buscar y Mapa de quien trabaja | `buscar`, `map` | trabajador | 🔵 `/map` ya traía panel de 400 px + mapa (sin cambios, con prueba). `/buscar` desde `lg` (1024 px): la lista en una columna y el mapa de turnos al lado, pegado arriba al bajar; tocar un pin resalta la fila y pasar el mouse por una fila resalta su pin; en celular y tablet no se monta el mapa (`app/buscar/page.tsx`, `worker/ShiftMap` con `sinOrigen`) |
| 11 | Mis turnos de quien trabaja | `my-shifts` | trabajador | 🔵 desde el 2026-11-24 la tarjeta de hoy y los demás turnos fluyen en dos columnas desde `md` (antes tres en `xl`, de ~300 px, con huecos y la tarjeta de hoy sola); Terminados, Postulaciones y Guardados también de a dos. Sin panel de detalle aparte: cada turno ya trae todo y sus acciones adentro (`app/my-shifts/page.tsx`) |
| 12 | Detalle del turno | `turno/[id]` | trabajador | 🔵 desde `lg`: la portada (foto o cielo) a la izquierda y la hoja con el pago y «Postularme» a la derecha, en el marco de 1024 px (`components/ShiftDetail.tsx`; prueba opt-in `e2e/turno-en-compu.spec.ts`) |
| 13 | Perfil de quien trabaja y ficha pública | `profile`, `workers/[id]` | trabajador | 🔵 igual que el 7: ya estaban bien en dos columnas, sólo se sumó la prueba (`e2e/perfil-suave.spec.ts`, `e2e/fichas-suaves.spec.ts`; la ficha usa `profile/FichaTrabajadorContenido`, que se comparte con Candidatos) |
| 14 | Chats (ya en dos columnas: revisar) | `chats` | los dos | 🔵 revisado el 2026-11-24 a 1440 px, de los dos lados: ya estaba bien (lista de 380 px y conversación al lado, burbujas de ~460 px, campo dentro del panel); sin cambios de código, sólo la prueba de disposición en `e2e/chats-suave.spec.ts` |
| 15 | Editar perfil y Ajustes | `profile/edit`, `profile/settings` | los dos | 🔵 el formulario y los ajustes miden 640 px en la compu (antes 576), centrados bajo el marco: prop `formulario` de `SubpaginaSuave` (`profile/ProfileParts`); prueba en `e2e/editar-perfil-suave.spec.ts` |
| 16 | Asistente | `assistant` | los dos | 🔵 desde `md` la conversación mide el ancho de lectura (`--app-reading`, 640 px de contenido) en vez de los 448 del celular, con burbujas de hasta el 85 % de esa columna (~545 px) y el campo de escribir en esa columna (`app/assistant/page.tsx`); sigue en la piel vieja, sin la dirección suave |
| 17 | Soporte | `support` | los dos | 🔵 revisado el 2026-11-24: la lista (544 px) y el ticket (ancho de lectura) ya estaban bien; sin cambios de código, sólo la prueba de disposición del ticket en `e2e/favoritos-soporte-suave.spec.ts` |
| 18 | Ingresar, crear cuenta, recuperar, bienvenida, verificar email | `login`, `register`, `recuperar`, `restablecer`, `bienvenida`, `verificar-email` | los dos | 🔵 dos columnas desde `lg` en `components/acceso/PantallaAcceso.tsx`: el cielo grande con el título, qué es Oído y dos fotos; la hoja con el formulario |
| 19 | Términos, privacidad, historia, encuesta | `terminos`, `privacidad`, `historia`, `encuesta` | público | 🔵 legales con índice lateral fijo desde `lg` (`components/legal/IndiceLegal.tsx`, texto intacto) y tarjeta de 736 px; encuesta con el cielo alineado a la columna de preguntas; `/historia` ya era responsive y no se tocó |
| 20 | Administración (métricas, personas, leads, soporte, verificación, seguridad, en vivo, herramientas) | `admin/*` | admin | 🔵 mirada a 1440 px en claro y oscuro: la cáscara (menú lateral + contenido en el marco de 72 rem) ya aprovechaba el ancho; sólo se arreglaron la pastilla «Prioridad baja» de Crecimiento y los encabezados partidos de la serie semanal de Métricas |

La landing (`/`) queda como está (decisión del 2026-11-24): ya es responsive.
