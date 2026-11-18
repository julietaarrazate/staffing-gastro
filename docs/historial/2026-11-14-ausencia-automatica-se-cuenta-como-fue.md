# La ausencia automática se cuenta como fue (G3, U082/U089; #562)

**Pedido:** salida a beta, grupo G3. Hoy el aviso de ausencia decía siempre
«El comercio marcó que no te presentaste», aun cuando nadie lo marcó y fue el
sistema; no decía cómo reclamar; llevaba a una pantalla vacía; y el perfil
escondía cancelaciones y ausencias hasta el primer turno hecho.

**Qué cambió:**
- `backend/app/modules/shift/application/services.py` (`mark_no_show`): con
  `_trigger="automatic"` el trabajador recibe «No registramos tu llegada al
  turno "X" y quedó como ausencia. Si fue un error, escribinos desde Soporte.»;
  el texto manual suma «Si fue un error, escribinos desde Soporte.». Mismos
  destinatarios y mismo disparo que antes; la penalidad no cambia.
- El aviso lleva al perfil: `link="/profile"` explícito, más
  `notification/domain/value_objects.py` (push) y `frontend/lib/notification-link.ts`
  (avisos viejos sin link) en `/profile` en vez de `/my-shifts`.
- `frontend/components/worker/WorkerGameCard.tsx` (perfil propio): sin turnos
  hechos, si hay al menos una cancelación o ausencia se muestran las dos; con
  turnos, aparece el tile «Ausencias» cuando hay al menos una (grilla 2x2).
  El componente sólo se usa en `/profile`: lo que ve un comercio sale de otra
  pantalla y no cambia.
- Tests: `tests/test_shift_not_covered.py`, `tests/test_scheduler.py`, `tests/test_no_show_and_late_cancellation.py`,
  `lib/notification-link.test.ts`, `components/worker/WorkerGameCard.test.tsx`.
- Docs: `docs/reference/NOTIFICATIONS.md`.

**Por qué así:** el link del aviso es uno solo; el texto menciona Soporte pero
el destino es el perfil, así no hay dos destinos que se contradigan.

**Aviso al comercio (decisión de Julieta/coordinación):** el comercio no recibe
aviso propio de la ausencia, y no se agrega ninguno (cambiaría quién recibe
qué). Lo que sí se corrige es el de «no cubierto» (`mark_not_covered`, mismo
título, tipo y destinatario): tras una ausencia decía «sin que nadie
confirmara», que es falso. Ahora, si el turno tuvo ausencia (`no_show_at`),
dice «"X" quedó sin cubrir: una persona confirmada no se presentó y no se
consiguió reemplazo a tiempo. Podés publicarlo de nuevo.». La revisión
independiente mostró que una primera versión («La persona confirmada no marcó
su llegada…», condicionada a que no hubiera nadie asignado) mentía si A falta,
B lo reemplaza, confirma y cancela: `no_show_at` no se limpia nunca, así que el
texto actual es el que vale en todos los caminos con ausencia. Tests en
`tests/test_shift_not_covered.py` (sin reemplazo, reemplazo sin confirmar,
reemplazo que canceló).

**Soporte en un toque:** el perfil propio muestra, con al menos una ausencia o
cancelación, «¿Alguna no corresponde? Escribinos a Soporte» con link a
`/support` (`WorkerGameCard.tsx`).

**Queda abierto:** que la ausencia automática coincida con el fin de la
búsqueda va con U080.
