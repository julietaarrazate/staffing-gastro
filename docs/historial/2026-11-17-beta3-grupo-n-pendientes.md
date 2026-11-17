# Beta etapa 3 · Grupo N (pendientes): barra de abajo a 320 px y campanita con 2FA pendiente

**Pedido:** cerrar los dos pendientes que dejó #608 (guardas de rol y 2FA de admin).

**Qué cambió:**
- **Barra de abajo del trabajador.** Con seis pestañas (Inicio, Buscar, Mapa, Matches, Chats, Perfil) la barra pedía 372 px y «Perfil» salía cortada a 360 px (a 320 px, peor). Cada pestaña llevaba un pill con 20 px de relleno a cada lado, o sea 62 px mínimos por pestaña. Ahora el pill ocupa el ancho de su pestaña con tope de 62 px (`frontend/components/BottomNav.tsx`): con cuatro pestañas se ve igual que antes; con seis se achica y a 320 px cada una tiene 53 px. Alto táctil (44 px o más), nombres y tamaño de letra no cambian.
- **Campanita con el alta de 2FA pendiente.** Antes `twoFactorSetupPending` se sabía recién con el primer 403 `two_factor_setup_required`, así que la campanita hacía un `GET /notifications` que el backend rechazaba. Ahora `GET /auth/me` y el login (`TokenResponse`) traen `two_factor_setup_required` (`backend/app/modules/identity/api/schemas.py`, `api/routes.py`, `application/services.py`, `application/dtos.py`), calculado con el mismo `AdminGate` del candado, sin migración. `frontend/lib/auth-context.tsx` marca el alta pendiente en el mismo paso que guarda el usuario (restaurar sesión o login), antes de que monte el `Navbar`. Quién ve qué no cambia: el candado sigue en el backend.

**Por qué así:** la señal viaja con datos que el backend ya tiene en cada pedido de sesión (no hace falta otra consulta ni otro endpoint). Sólo se prende la marca; apagarla sigue siendo del alta (`adoptSession`). El campo va en `MeResponse` (hereda de `UserResponse`) y no en `UserResponse`, para no sumarlo a las respuestas embebidas que no lo calculan.

**Pruebas:** `e2e/barra-de-abajo.spec.ts` (las pestañas de cada rol entran enteras, repartidas y con 44 px de alto a 360 y 320 px; el admin con el alta pendiente no pide `/notifications`), `lib/auth-context.test.tsx` (la marca llega junto con el usuario, nunca hay un render con usuario y sin marca), `backend/tests/test_dos_pasos_admin.py`.

**Queda abierto:** nada de este grupo. Si el admin con el alta pendiente cae en una pantalla que no pide nada del panel, no se lo lleva solo a `/admin/seguridad` (lo hace el primer 403, como antes).
