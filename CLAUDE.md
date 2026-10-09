# CLAUDE.md — Cómo trabajar en Staffya

Índice corto: dice **cómo** trabajar y **dónde** está cada cosa. Lo demás vive en `docs/`; abrí solo lo que la tarea toca.

**Staffya** (marca "Oído"): marketplace de staffing gastronómico en tiempo real; misión, cubrir un turno en menos de 10 min. Roles `worker`, `employer`, `admin`. Todo el producto en **español (AR)**. Backend FastAPI + SQLAlchemy async (DDD/hexagonal, Render), frontend Next.js/TS/Tailwind/PWA (Vercel), base en Neon (connection string **directa**, sin `-pooler`).

## Ahorro de tokens (pedido de Julieta, 2026-10-09)

1. **Leé lo mínimo, una vez.** Orden de arranque: este archivo → `docs/STATUS.md` → `docs/reference/MAPA_DEL_CODIGO.md` (antes de `grep`, y antes de proponer una función nueva). Después, solo los archivos que la tarea toca, con `Grep`/`Glob` primero y `Read` por rango de líneas. No releas lo que ya leíste en la sesión.
2. **No leas esto** salvo que la tarea lo pida: `docs/historial/` (bitácora, solo se *escribe*), `docs/audits/`, `docs/mockups/`, `docs/fundraising/`, `marketing/` (42 MB de videos), lockfiles, `node_modules/`, capturas e imágenes. `.claude/settings.json` ya bloquea la lectura de las más pesadas.
3. **Tests proporcionales:** solo los del área tocada mientras iterás; la suite completa una vez, antes de pedir el merge. Capturas en los dos temas solo si el cambio es visual.
4. **Modelos:** quien orquesta (Opus) diseña lo complejo; el trabajo diario va en Sonnet; lo mecánico (renombres, capturas, bumps, copys, búsquedas) se delega al subagente `mecanico` (Haiku, ver `.claude/agents/`). Subagentes solo si paralelizar ahorra de verdad, con brief corto y rutas exactas.
5. **Respuestas cortas**, sin repetir contexto ni entregables que nadie pidió.

## Protocolo de sesión (obligatorio)

1. **Aislarse en worktree** desde el primer comando (también para leer): `git worktree add ../staffya-<tema> -b claude/<tema> origin/main`. En la nube la rama de la sesión ya está checkouteada, así que va `git checkout -q --detach && git worktree add ../staffya-<tema> <rama>` ([receta](./docs/reference/SESION_CLOUD.md)). Cada worktree necesita su `npm ci`. `git worktree list` debe mostrar más de una entrada antes del primer commit.
2. **Leer el estado, no el código**: `docs/STATUS.md` (corto) y el mapa del código. `docs/TECH_DEBT.md` y `docs/BUGS.md` solo si el tema los toca.
3. **Buscar los bugs vos.** Todo cambio de UI se mira **renderizado**, en `data-theme="light"` y `"dark"` (tsc/build/tests en verde no detectan contraste ni superficies). Toda medición de diseño declara su marco (elemento y viewport).
4. **Dejar el estado escrito en el MISMO PR**: entrada nueva en `docs/historial/` (formato en su README), ítem de `docs/STATUS.md` si abre o cierra algo, y los `docs/` del área si el cambio los contradice (más la fila de `MAPA_DEL_CODIGO.md` si agregás una pantalla o pieza).
5. **Cerrar con CI verde** mirando la corrida real en GitHub (`CI` y `Security`), no una local. Si tras el push no aparece corrida, mirá si el PR tiene conflicto.

## Antes de modificar código

1. Entender el dominio (`docs/foundation/DOMAIN.md`) y el módulo (`backend/app/modules/<x>/`). Si el código contradice la doc, frená y corregí uno u otro.
2. Buscar antes de crear: componentes en `frontend/components/ui/`, servicios y helpers existentes. No duplicar.
3. Respetar capas `domain`/`application`/`infrastructure`/`api` (las dependencias apuntan al dominio; hay un test que lo exige: `backend/tests/test_arquitectura_capas.py`). Cruces entre módulos por puerto inyectado.
4. Un cambio, un propósito; PR acotado.
5. Feature nueva: dominio sin frameworks → caso de uso sobre puertos → adaptadores + migración Alembic (y registrar el modelo en `tests/conftest.py`) → API con no-disclosure (ajeno/inexistente = 404) → frontend con el Design System, sin `localhost` (usar `NEXT_PUBLIC_API_URL`) → tests → actualizar `docs/`.

## Calidad — antes de commitear

Backend `pytest -q`. Frontend `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm run build`. E2E `npm run test:e2e` (Playwright, API mockeada). Reportá el resultado **real**; si citás cuántos tests hay, contalos en el momento.

## Git y cierre de PR

- Rama de feature, commits descriptivos, **PR en draft**, merge con **squash**, **no `git add -A`**.
- Secuencia acordada con Julieta (no repreguntar): **CI y Security en verde (corrida real) → captura claro y oscuro si hay UI → "sí" de Julieta → squash merge y avisar qué quedó en producción.** Nunca mergear en rojo ni tocar el pipeline para que dé verde.

## No hacer

Duplicar componentes o lógica · acoplar módulos por dentro · credenciales en código o chat · `localhost` en config de producto · infraestructura pesada sin ADR · cambiar una decisión arquitectónica sin **ADR nuevo** (`docs/adr/`).

## Reglas de dominio que se rompen fácil

- Fechas de negocio con `hoy_art()`/`now_art()` (`backend/app/core/tz.py`); auditoría en UTC.
- Si cambia el texto de `/terminos` o `/privacidad`, subir `LEGAL_TERMS_VERSION` (backend) y `frontend/lib/legal.ts` en el mismo PR. "Va en camino" y "Disponible ahora" tienen modelo de privacidad deliberado: leer su ADR / `docs/reference/QUE_EXISTE_HOY.md` antes de tocarlos.
- Diseño v5.0: fuente de verdad en `docs/design-system/` (`color-system.md`, `typography.md`); todos los fondos por tokens de `globals.css`, un solo acento ámbar por pantalla, tema explícito (`lib/theme.tsx`).

## Dónde está cada cosa

| Necesito… | Archivo |
|---|---|
| Qué está abierto / qué sigue | `docs/STATUS.md` |
| Ubicar pantalla o pieza de código | `docs/reference/MAPA_DEL_CODIGO.md` |
| Funcionalidades vigentes y contexto de producto | `docs/reference/QUE_EXISTE_HOY.md` |
| Env vars, dominio, deploy, trámites de Julieta | `docs/reference/PENDIENTE_OPERATIVO.md`, `docs/reference/DEPLOY.md` |
| Índice completo de `docs/` y ADRs | `docs/reference/MAPA_DE_DOCS.md` |
| Correr tests/Playwright/capturas en la nube | `docs/reference/SESION_CLOUD.md` |
| Bugs ya resueltos / deuda vigente | `docs/BUGS.md` · `docs/TECH_DEBT.md` |
| Bitácora de cambios (solo escribir) | `docs/historial/` |

## EKP (repo hermano `julietaarrazate/ekp`, capa L5 = este repo)

Durante el trabajo es de **solo lectura** y solo para decisiones grandes (`engines/decision-engine.md`, `domains/design|ux/`, `engines/review-engine.md`); para un bug o feature normal alcanza `docs/`. Antes de cerrar, si hubo fricción que se va a repetir (regla no escrita, trampa de un endpoint, pedido malinterpretado), se archiva **por qué fue posible** como *cycle* al final de `evolution/INTAKE.md` de EKP (append, nunca editar lo anterior) más su línea en `tasks/BACKLOG.md`, en un PR aparte (`add_repo` + clonar). Si el trabajo *es* EKP, abrir la sesión allá.
