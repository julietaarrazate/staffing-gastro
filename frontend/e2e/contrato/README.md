# e2e/contrato — mocks armados con respuestas reales del backend

Los e2e simulan la API con `page.route(...)`. Un mock escrito a mano puede
mentir: inventar un campo, olvidarse de uno, o mandar un status que el servidor
nunca manda para ese caso (en G8 los tests pasaban con un 422 que el backend no
mandaba). Acá los mocks salen de respuestas reales.

## Qué hay

- `respuestas.json` — `{ nombre: { status, body } }`. **Lo escribe el test del
  backend, no se edita a mano.** Sin UUIDs ni tokens (gitleaks los toma por
  claves): los ids son `shift-1`, `user-worker-1`, `application-1`…; el token es
  `token-de-prueba`; las fechas de creación son una fija; los horarios, el 20 y
  21 de diciembre de 2026.
- `../contrato.ts` — `respuesta(nombre)`, `deContrato(nombre, cambios)`,
  `fulfillContrato(route, nombre, cambios?)` y `opcionesDeContrato(...)`.
- `backend/tests/test_contrato_frontend.py` — recorre los escenarios contra la
  app (cliente ASGI de los tests) y captura cada respuesta.
- `frontend/lib/contrato.test.ts` — asigna cada respuesta a su tipo de
  `lib/types.ts`: si el tipo promete un campo que el backend no manda (o con
  otro tipo), `tsc --noEmit` falla.

## Cómo se regenera

```bash
cd backend
ACTUALIZAR_CONTRATO=1 /tmp/claude-0/venv311/bin/python -m pytest -q tests/test_contrato_frontend.py
```

Sin la variable, el test **compara la forma** (claves recursivas, tipo JSON de
cada valor y status) contra el archivo y falla diciendo qué cambió y con qué
comando regenerar. Es lo que hace que un cambio de schema del backend que el
frontend no acompañó rompa CI. Regenerar y mirar el diff de `respuestas.json`
es parte del PR: ahí se ve qué cambió para el frontend.

Para sumar un escenario, agregá un `cap.guardar("nombre", await client...)` en
`test_contrato_frontend.py` (las listas con filas del mismo `created_at` van con
`ordenar=True`, para que el archivo sea estable entre corridas) y regenerá.

## Cómo se usa en un spec

```ts
import { deContrato, fulfillContrato } from "./contrato";

// Sesión: el auth/me real del rol.
await page.route("**/api/v1/auth/me", (r) => fulfillContrato(r, "auth_me_worker"));

// Un error real, con su status real (acá 400, no 409).
await page.route("**/shifts/shift-1/confirm", (r) =>
  fulfillContrato(r, "turno_cancelado_confirmar"));

// Un turno real con otro estado; una lista armada sobre el primer elemento real.
const turno = deContrato("turno_confirmado_trabajador", { status: "cancelado" });
const lista = deContrato("turnos_del_comercio", [{ id: "a" }, { id: "b", status: "asignado" }]);
```

`deContrato` **tira error si un cambio agrega una clave que la respuesta real
no tiene** (también anidada): «el mock manda un campo que el backend no manda».
Si el escenario que necesitás no está, agregalo al test del backend en vez de
escribir el objeto a mano.

## Límites

- Un campo que en el escenario capturado es `null` queda como `null`: el
  contrato prueba que existe, no con qué valores. Si un spec necesita el campo
  lleno, lo pone en `cambios` (la clave tiene que existir).
- La forma que se compara no distingue uniones de strings (`ShiftStatus`): el
  tipo de `types.ts` se revisa con `Ensanchar<T>` y las uniones, a mano.
- Errores que el backend no genera (5xx, 429, corte de red) siguen escritos a
  mano en cada spec: no hay respuesta real que copiar.
