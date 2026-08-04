# TESTING.md — Estrategia de pruebas (arquitectura técnica)

> Cómo se prueba Staffya y qué falta. Amplía
> [ARCHITECTURE.md](../foundation/ARCHITECTURE.md#tests). Los quality gates previos a commit
> están en [CLAUDE.md](../../CLAUDE.md#calidad--antes-de-commitear).

## Backend

- **Runner:** `pytest` + `pytest-asyncio`. Comando: `pytest -q` (debe quedar
  **verde** antes de commitear).
- **DB de test:** **SQLite en memoria** (`sqlite+aiosqlite:///:memory:`), sin DB
  externa. Las tablas se crean con `Base.metadata.create_all` desde
  `tests/conftest.py`. Cada test recibe un `session_factory` y un `client`
  (`httpx.AsyncClient` sobre la app ASGI) con `get_session` sobreescrito.
- **Nivel:** tests de **caso de uso / integración por endpoint** (uno por módulo):
  `test_identity`, `test_worker`, `test_company`, `test_shift`,
  `test_attendance`, `test_application`, `test_matching`, `test_notification`,
  `test_chat`, `test_review`, `test_admin`.

> **Registrar modelos nuevos.** `conftest.py` importa explícitamente los
> `infrastructure/models.py` de cada módulo para poblar la metadata antes de
> `create_all`. **Un modelo nuevo no importado ⇒ su tabla no existe en los
> tests** (falla silenciosa). Ver [DATABASE.md](./DATABASE.md).

## Frontend

- **Gates:** `npx tsc --noEmit` (tipos) **y** `npm run build` (compila). No hay
  suite de tests unitarios ni e2e todavía.
- Lint: `eslint` (`npm run lint`).

## Qué se cubre hoy

- Camino feliz y principales reglas de negocio de cada módulo backend
  (auth, ciclo de vida del turno, postulación, matching, reseñas, moderación).
- Reglas de acceso (no-disclosure / 404, permisos por rol) a nivel endpoint.

## Brechas (a cerrar — Fase de Calidad)

> - **Frontend sin tests automatizados.** Sólo typecheck + build. Falta al menos
>   testing de componentes del Design System y de los flujos críticos (login,
>   postularse, asignar). Ver [TECH_DEBT.md](../TECH_DEBT.md).
> - **Sin cobertura medida** en backend (no hay `--cov` en el flujo).
> - **Sin tests de WebSocket** (chat/notificaciones en vivo).
> - **Sin CI que corra los gates** de forma obligatoria en cada PR documentado
>   (verificar estado real en [DEPLOY.md](./DEPLOY.md)).
> - **Diferencia SQLite ↔ PostgreSQL:** los tests corren en SQLite; conviene una
>   corrida ocasional contra Postgres para detectar divergencias (tipos, JSON,
>   constraints).
