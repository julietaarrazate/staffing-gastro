# bcrypt fuera del event loop: un login ya no congela a todos (#PR)

**Pedido:** Julieta aprobó el plan de rendimiento del backend (medición del
2026-10-22). El backend corre en **un solo proceso** de uvicorn y bcrypt
(~250 ms a costo 12, CPU puro) se llamaba directo desde código async: cada
login, registro o cambio de contraseña dejaba congelado al proceso entero, y
con él a todos los demás usuarios.

**Qué cambió:** para quien usa la app, nada visible salvo que la app no se
traba cuando otra persona inicia sesión.

- `backend/app/core/security.py`: `hash_password_async` y
  `verify_password_async`, que corren bcrypt con `asyncio.to_thread`. Las
  versiones síncronas siguen (las usa el hash ficticio que se calcula una vez
  al importar, y los tests).
- `backend/app/modules/identity/application/services.py`: registro, login
  (también la verificación contra el hash ficticio cuando el email no
  existe), reset de contraseña y la contraseña local imposible de las cuentas
  de Google/invitado usan las variantes async.
- `backend/app/modules/admin/application/services.py`: la contraseña local
  de las cuentas de prueba, igual.
- Test nuevo en `backend/tests/test_password_hashing.py`: mientras
  `verify_password_async` calcula, el event loop sigue girando.

**Medición (antes → después).** Script
`perf/bench_bcrypt.py` (scratchpad de la sesión): 4 logins concurrentes con
bcrypt a costo 12 (el de producción) mientras otra tarea pide `GET /health`
cada 10 ms y un ticker mide el retraso del event loop. httpx + ASGITransport,
SQLite en archivo (una conexión por request, como en producción). 5 corridas
de cada lado:

| | Antes (main) | Después |
|---|---|---|
| Retraso máximo del event loop | 522 – 1.173 ms | 8 – 29 ms |
| `/health` más lento durante los logins | hasta 1.247 ms | ≤ 40 ms |
| `/health` atendidos durante los logins | 11 – 21 | 40 – 47 |
| Los 4 logins, de punta a punta | 1.183 – 1.339 ms | 500 – 602 ms |

Los logins además terminan antes porque bcrypt suelta el GIL y los hilos
calculan en paralelo.

**Por qué así:** `asyncio.to_thread` usa el pool de hilos por defecto, sin
infraestructura nueva. Se agregaron funciones `*_async` en `core/security.py`
en vez de envolver en cada caso de uso, así la regla vive en un solo lugar y
la capa de aplicación sigue sin saber de hilos. Se descartó bajar el costo de
bcrypt (sería bajar la seguridad) y sumar workers de uvicorn (más memoria en
el plan free y el rate limiter vive en memoria).

**Queda abierto:** nada.
