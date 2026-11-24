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
| 1 | Panel del comercio | `feed` (comercio) | comercio | ⚪ |
| 2 | Candidatos, con la ficha al lado | `shifts` / `turno/[id]` | comercio | ⚪ |
| 3 | Publicar turno y publicar evento | `shifts/new`, `shifts/new-event` | comercio | ⚪ |
| 4 | Buscar y Mapa del comercio | `buscar`, `map` | comercio | ⚪ |
| 5 | Mis turnos del comercio | `my-shifts` | comercio | ⚪ |
| 6 | Mi plan | `subscription` | comercio | ⚪ |
| 7 | Perfil del comercio y ficha pública | `profile`, `companies/[id]` | comercio | ⚪ |
| 8 | Favoritos | `favorites` | comercio | ⚪ |
| 9 | Inicio de quien trabaja | `feed` (trabajador) | trabajador | ⚪ |
| 10 | Buscar y Mapa de quien trabaja | `search`, `map` | trabajador | ⚪ |
| 11 | Mis turnos de quien trabaja | `my-shifts` | trabajador | ⚪ |
| 12 | Detalle del turno | `turno/[id]` | trabajador | ⚪ |
| 13 | Perfil de quien trabaja y ficha pública | `profile`, `workers/[id]` | trabajador | ⚪ |
| 14 | Chats (ya en dos columnas: revisar) | `chats` | los dos | ⚪ revisar |
| 15 | Editar perfil y Ajustes | `profile/edit`, `profile/settings` | los dos | ⚪ |
| 16 | Asistente | `assistant` | los dos | ⚪ |
| 17 | Soporte | `support` | los dos | ⚪ |
| 18 | Ingresar, crear cuenta, recuperar, bienvenida, verificar email | `login`, `register`, `recuperar`, `restablecer`, `bienvenida`, `verificar-email` | los dos | 🔵 dos columnas desde `lg` en `components/acceso/PantallaAcceso.tsx`: el cielo grande con el título, qué es Oído y dos fotos; la hoja con el formulario |
| 19 | Términos, privacidad, historia, encuesta | `terminos`, `privacidad`, `historia`, `encuesta` | público | ⚪ |
| 20 | Administración (métricas, personas, leads, soporte, verificación, seguridad, en vivo, herramientas) | `admin/*` | admin | ⚪ |

La landing (`/`) queda como está (decisión del 2026-11-24): ya es responsive.
