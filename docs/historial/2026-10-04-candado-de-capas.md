# Candado de capas en el backend (#401)

**Pedido:** Julieta propuso implementar Oído con arquitectura hexagonal, para
no mezclar lógica de negocio, infraestructura y frameworks. Del diagnóstico
eligió "candado solo": frenar fugas nuevas sin refactorizar.

**Qué cambió:** nada que vea el usuario. `backend/tests/test_arquitectura_capas.py`
lee los imports de `backend/app/modules/**` con `ast` (también los que están
adentro de funciones) y hace fallar el `pytest` del CI si `domain/` importa un
framework o infraestructura, si `application/` importa adaptadores
(`*.infrastructure`, `*.api`, sesión de base, JWT, websockets) o si algo
fuera de `infrastructure/` llama al cliente de Gemini. Regla escrita en
`docs/foundation/PRINCIPLES.md` §6 y referenciada en `ARCHITECTURE.md`.

**Por qué así:** el backend **ya era hexagonal** (15 de 17 módulos con
`domain/ application/ infrastructure/ api/`, dominio sin imports de
framework, repos como puertos `abc` con adaptadores SQLAlchemy), así que
reimplementar no tenía sentido. Lo que faltaba es que la regla se cumpla
sola: escrita, dependía de que cada sesión la leyera. Se descartó
`import-linter` porque sumaba una dependencia y un paso de CI para lo mismo
que hace un test de 150 líneas dentro del `pytest` que ya corre.

**Queda abierto:** las fugas que ya estaban, listadas en `EXCEPCIONES` del
test (sólo se borran, nunca se agregan; el test falla si una sobra):
`shift/application/scheduler.py` abre sesiones y arma repos SQLAlchemy de 9
módulos; `chat` empuja por `ws_manager` desde el caso de uso; `identity` y
`admin` usan JWT/bcrypt sin puerto; las rutas de `shift`, `support` y
`assistant` llaman a Gemini directo. Lo que el test no ve: las reglas de
visibilidad de un turno viven en `shift/api/routes.py` y corresponden al
dominio. En el frontend, ~75 llamadas `api.get/post("/ruta")` están
repartidas en 32 pantallas y componentes; queda como idea, sin candado. Se
cierran de a una cuando se toque ese código, sin PR de refactor dedicado.
