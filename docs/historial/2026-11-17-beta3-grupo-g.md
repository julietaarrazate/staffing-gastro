# Beta etapa 3, grupo G: Candidatos, perfil y Buscar

## Pedido
Hallazgos U022, U027 y U074 de `docs/planning/BETA_ETAPA3_TRIAJE.md`.

## Qué cambió
- **U022**: `/shifts/[id]/candidates` ya no ofrece «Asignar» (ni en Postulantes ni en Recomendados) cuando el turno no está en `publicado` o `buscando_personal`, los mismos estados desde los que el servidor deja asignar (`Shift.assign`). En su lugar muestra un aviso con el estado del turno. `CandidateCard` recibe `canAssign`.
- **U027**: Candidatos tiene «‹ Mis turnos» arriba (link a `/shifts`) y el perfil público del trabajador tiene «‹ Volver» (`router.back()`), con el mismo estilo que el resto de las pantallas.
- **U074**: Buscar guarda rol y radio en `sessionStorage` (con try/catch) y los restaura al volver; `?skill=` de la URL manda. La píldora de filtros pasa de `bg-white/95` a `bg-card/95`. El radio muestra «km» al lado y tiene `aria-label`.
- Spec nuevo `frontend/e2e/candidatos-buscar-grupo-g.spec.ts`.

## Por qué así
Mientras el turno no cargó se asume asignable: el servidor decide igual y no se esconde la acción por una falla del resumen. El volver del perfil usa `router.back()` porque se llega desde Candidatos, Buscar, Favoritos o chats.

## Queda abierto
La «Garantía Oído» sigue visible en un turno cerrado (es informativa).
