# Cache-Control en los GET públicos: planes 5 minutos, turno público sin caché (#PR)

**Pedido:** Julieta aprobó el plan de rendimiento del backend (medición del
2026-10-22). El backend no mandaba `Cache-Control` en ninguna respuesta, ni
siquiera en `GET /subscription/plans/public`, que es configuración fija sin
base de datos.

**Qué cambió:** quien vuelve a la landing dentro de los 5 minutos ve los
precios sin volver a pedirlos a Render (y sin despertarlo si estaba dormido).

- `backend/app/modules/subscription/api/routes.py`: `GET /subscription/plans/public`
  responde `Cache-Control: public, max-age=300` (`PUBLIC_PLANS_CACHE_CONTROL`).
  `/subscription/plans` (con sesión) no cambia.
- `backend/app/modules/shift/api/routes.py`: `GET /shifts/{id}/public`
  responde `Cache-Control: no-cache` en el 200.
- Tests: `backend/tests/test_cache_publico.py`.

**Medición (antes → después).** Headers de la respuesta (equivalente a
`curl -I`, script `perf/bench_headers.py` del scratchpad de la sesión):

| GET | Antes | Después |
|---|---|---|
| `/subscription/plans/public` | sin `Cache-Control` | `public, max-age=300` |
| `/shifts/{id}/public` | sin `Cache-Control` | `no-cache` |

Con eso, una segunda visita a la landing dentro de los 5 minutos pasa de 1
request a Render a 0 para los planes. El bench de consultas no cambia: los
planes ya hacían 0 consultas y el turno público 2.

**Por qué así:**
- Planes: son iguales para todos y solo cambian con un deploy. 5 minutos es
  lo máximo que tardaría en verse un cambio de precio, y se aceptó por ser
  configuración. `public` permite que lo guarde también una caché compartida;
  la respuesta no depende de quién la pide.
- Turno público: se descartó cachearlo. Un turno se puede cubrir en minutos
  (la misión es menos de 10) y desde ese momento tiene que dar 404. Una copia
  vieja en el navegador o en una caché intermedia mostraría como abierto un
  turno ya tomado. La página que se comparte por WhatsApp ya tiene su caché
  corta en el borde (`frontend/cloudflare/turno-cache.mjs`), y esa sí sabe
  renovarse y borrar la copia cuando el turno deja de dar 200. Se pone
  `no-cache` explícito, y no solo nada, para que ningún intermediario aplique
  caché heurística.

**Queda abierto:** nada.
