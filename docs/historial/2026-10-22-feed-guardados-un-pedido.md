# Feed: el estado de "guardado" sale de un pedido, no de uno por tarjeta

**Pedido:** Julieta, 2026-10-22: optimizar requests y caching, midiendo antes
y después.

**Qué cambió:** cada tarjeta del feed preguntaba si su turno estaba guardado
(`GET /saved-shifts/{id}/status`): con 30 turnos eran ~31 pedidos más su
preflight CORS cada uno. Ahora todas las tarjetas comparten un solo
`GET /saved-shifts/ids`, y guardar o quitar actualiza ese mismo conjunto
(también en el detalle del turno). Técnico:

- Backend: `GET /saved-shifts/ids` (`backend/app/modules/saved_shift/api/routes.py`,
  `SavedShiftService.list_my_saved_shift_ids`), con test en
  `tests/test_saved_shift.py`. `/{id}/status` queda por compatibilidad.
- Frontend: `frontend/lib/saved-shifts.ts` (estado compartido con
  `useSyncExternalStore`, un pedido por sesión y deduplicado) y
  `components/worker/SaveShiftButton.tsx` lo usa. E2E actualizado.

**Medición** (scripts del relevamiento: build de producción con DSN de Sentry,
API simulada a 80 ms, mediana de 3; celular con CPU 4x y 4G lenta):

| `/feed` | Antes | Después |
|---|---|---|
| Pedidos (celular) | 126 | 66 |
| Pedidos (escritorio) | 116 | 56 |
| Preflights CORS | 36 | 6 |
| KB de API | 31,9 | 24,1 |
| LCP celular | 4,95 s | 4,71 s |
| LCP escritorio | 0,81 s | 0,57 s |
| Turno visible (celular) | 5,95 s | 5,54 s |

**Queda abierto:** el feed sigue montando las versiones de celular y
escritorio a la vez y las tarjetas se re-renderizan de más (INP ~460 ms en
celular); va en otro PR.
