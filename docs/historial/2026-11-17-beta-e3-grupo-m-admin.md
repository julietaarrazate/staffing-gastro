# Beta etapa 3, grupo M: panel de admin (U129, U131, U132, U134)

**Pedido:** triaje de la etapa 3 (`docs/planning/BETA_ETAPA3_TRIAJE.md`), cuatro hallazgos del panel de admin.

**Qué cambió:**
- **U129 «Turnos en vivo»:** los totales (Todos, Urgentes, Escalados, Ausencias) ya no salen de las filas cortadas en 200: una consulta de conteo aparte (`ShiftRepository.count_live`) los calcula sobre todo. La lista prioriza urgentes, escalados y después el publicado más reciente (antes el más viejo, y con tope los nuevos quedaban afuera sin aviso). La respuesta trae `shown_live` y `limit`, y `frontend/app/admin/en-vivo/page.tsx` avisa «Mostrando 200 de N turnos en vivo: faltan los más viejos».
- **U131 «Ver como»:** el cartel (`frontend/components/ImpersonationBanner.tsx`) parte línea en vez de `truncate`, así el nombre se ve en 390 px. Al recargar, `frontend/lib/auth-context.tsx` recupera la sesión de la admin (cookie de renovación, como siempre) y, si la pestaña estaba viendo como alguien, vuelve a pedir `POST /admin/users/{id}/impersonate` con el token de la admin. Si falla (persona borrada, servidor, sesión que no es admin) se limpia la marca y se va a `/admin` sin error.
- **U132 ficha de persona:** `ShiftRepository.list_history_by_worker` trae los turnos asignados y también aquellos con `last_no_show_worker_profile_id` de la persona (el no-show la desasigna). La fila trae `absent` y la ficha muestra «No se presentó». La regla de dominio de desasignar no se tocó.
- **U134:** nombre y mail de la ficha parten línea (`break-words`, `break-all`) en vez de cortarse.

**Por qué así:** sobre U131, el token impersonado sigue sin guardarse en ningún lado; sólo se guarda el id de la persona en `sessionStorage` (no es un secreto, dura lo que la pestaña). Re-pedir «ver como» exige una sesión admin válida y queda en el log de auditoría del backend, así que no abre nada nuevo. Se descartó guardar el token impersonado (menos seguro). Sobre U129, se prefirió «más reciente primero» porque lo que se pierde con tope debe ser lo viejo, y el aviso lo dice.

**Queda abierto:** nada. Con más de 200 turnos en vivo la lista sigue acotada (a propósito); el aviso lo hace visible.
