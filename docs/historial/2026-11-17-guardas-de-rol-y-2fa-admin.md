# Guardas de rol por URL y 2FA pendiente del admin (Beta etapa 3, grupo N)

**Pedido:** auditoría de la beta (U098, U133). Entrar por URL a una pantalla del otro rol mostraba la pantalla vacía con «Permisos insuficientes»; y el admin con el alta de 2FA pendiente seguía viendo la barra de abajo y la campanita, con pedidos de fondo que fallaban.

**Qué cambió:**
- `frontend/lib/use-require-auth.ts`: acepta `{ roles }`. Con la sesión resuelta (`loading` apagado), si el rol de `user` no está en la lista hace `router.replace(homeDelRol(role))` y devuelve `token: null` (y `allowed: false`) para que la pantalla no dispare pedidos. Sin `roles`, igual que antes. En «Ver como» juzga el rol de la cuenta que se mira.
- Roles por pantalla (los que exige el backend en sus endpoints): `shifts`, `shifts/new`, `shifts/new-event`, `shifts/[id]/candidates`, `subscription`, `favorites` → `employer` (`get_my_company_id`); `my-shifts` → `worker` (`get_my_worker_profile_id`).
- `BottomNav`, `NotificationBell` y `Navbar` (links de admin y campanita): con `twoFactorSetupPending` no se dibujan; la campanita no carga ni abre el socket.

**Por qué así:** el admin no entra a las pantallas de un solo rol porque el backend no lo deja (exigen comercio o trabajador). `feed`, `buscar`, `map`, `search` no se guardaron: su endpoint principal acepta a cualquier rol logueado, no dan el síntoma. Con el alta pendiente, la primera carga de la campanita sale antes de que el primer 403 avise que falta el alta: queda un solo pedido, sin reintentos ni socket.

**Queda abierto:** nada.
