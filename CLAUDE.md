# CLAUDE.md — Cómo trabajar en Staffya

Índice corto: dice **cómo** trabajar y **dónde** está cada cosa. Lo demás vive en `docs/`; abrí solo lo que la tarea toca.

**Staffya** (marca "Oído"): marketplace de staffing gastronómico en tiempo real; misión, cubrir un turno en menos de 10 min. Roles `worker`, `employer`, `admin`. Todo el producto en **español (AR)**. Backend FastAPI + SQLAlchemy async (DDD/hexagonal, Render), frontend Next.js/TS/Tailwind/PWA (Vercel), base en Neon (connection string **directa**, sin `-pooler`).

## Ahorro de tokens (pedido de Julieta, 2026-10-09)

1. **Leé lo mínimo, una vez.** Orden de arranque: este archivo → `docs/STATUS.md` → `docs/reference/MAPA_DEL_CODIGO.md` (antes de `grep`, y antes de proponer una función nueva). Después, solo los archivos que la tarea toca, con `Grep`/`Glob` primero y `Read` por rango de líneas. No releas lo que ya leíste en la sesión.
2. **No leas esto** salvo que la tarea lo pida: `docs/historial/` (bitácora, solo se *escribe*), `docs/audits/`, `docs/mockups/`, `docs/fundraising/`, `marketing/` (42 MB de videos), lockfiles, `node_modules/`, capturas e imágenes. `.claude/settings.json` ya bloquea la lectura de las más pesadas.
3. **Tests proporcionales:** solo los del área tocada mientras iterás; la suite completa una vez, antes de pedir el merge. Capturas en los dos temas solo si el cambio es visual.
4. **Modelos (acordado con Julieta, 2026-11-13):** quien coordina (el modelo más capaz) diseña, decide y hace lo delicado (pagos, privacidad, reglas del producto, arquitectura); los arreglos del día a día y las revisiones de cambios de pantalla van en Sonnet; lo mecánico (renombres, capturas, bumps, copys, búsquedas) se delega al subagente `mecanico` (Haiku, ver `.claude/agents/`). Nadie revisa su propio trabajo: cada arreglo lo revisa otro agente que intenta romperlo. Esfuerzo alto, no máximo, salvo auditorías o diseño difícil. Subagentes solo si paralelizar ahorra de verdad, con brief corto y rutas exactas; pocos a la vez y terminando lo empezado: si se corta el cupo de uso se pierde lo que estaba a medias.
5. **Respuestas cortas**, sin repetir contexto ni entregables que nadie pidió.
6. **Una conversación por etapa o por tanda.** Una sesión larga relee todo su contexto en cada paso. Al cerrar una tanda se deja el estado escrito ([tablero de la beta](./docs/planning/BETA_TABLERO.md), `docs/STATUS.md`, historial) y se le avisa a Julieta que conviene abrir una sesión nueva; la nueva arranca de esos archivos, no de la conversación anterior.

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
- **Permiso permanente (Julieta, 2026-11-13):** un arreglo con CI y Security en verde, **revisión independiente aprobada** y **prueba en la app** (entorno local, [`tools/e2e-local`](./tools/e2e-local/README.md) cuando esté en `main`) se mergea sin esperar el "sí" y se le avisa después, con capturas si toca pantalla. **Se pregunta antes** si toca textos legales, precios o planes, datos de producción, o cambia una regla del producto (quién ve o recibe qué, penalidades, plazos); ante la duda, se pregunta.

## No hacer

Duplicar componentes o lógica · acoplar módulos por dentro · credenciales en código o chat · `localhost` en config de producto · infraestructura pesada sin ADR · cambiar una decisión arquitectónica sin **ADR nuevo** (`docs/adr/`).

## Reglas de dominio que se rompen fácil

- Fechas de negocio con `hoy_art()`/`now_art()` (`backend/app/core/tz.py`); auditoría en UTC.
- Si cambia el texto de `/terminos` o `/privacidad`, subir `LEGAL_TERMS_VERSION` (backend) y `frontend/lib/legal.ts` en el mismo PR. "Va en camino" y "Disponible ahora" tienen modelo de privacidad deliberado: leer su ADR / `docs/reference/QUE_EXISTE_HOY.md` antes de tocarlos.
- Diseño: la marca vigente en una página es `docs/design-system/marca-hoy.md` (2026-10-19: celeste y blanco, un solo ámbar, el «oído» fileteado, noche azul en oscuro); valores en `color-system.md` y `typography.md`; todos los fondos por tokens de `globals.css`, un solo acento ámbar por pantalla, letra sobre la marca con `on-brand` (nunca `text-white`), tema explícito (`lib/theme.tsx`).

## Dónde está cada cosa

| Necesito… | Archivo |
|---|---|
| Qué está abierto / qué sigue | `docs/STATUS.md` |
| Salida a beta: qué está hecho, en curso y pendiente | `docs/planning/BETA_TABLERO.md` |
| La marca hoy (paleta, tipografía, filete, isotipo) | `docs/design-system/marca-hoy.md` |
| Ubicar pantalla o pieza de código | `docs/reference/MAPA_DEL_CODIGO.md` |
| Funcionalidades vigentes y contexto de producto | `docs/reference/QUE_EXISTE_HOY.md` |
| Env vars, dominio, deploy, trámites de Julieta | `docs/reference/PENDIENTE_OPERATIVO.md`, `docs/reference/DEPLOY.md` |
| Índice completo de `docs/` y ADRs | `docs/reference/MAPA_DE_DOCS.md` |
| Correr tests/Playwright/capturas en la nube | `docs/reference/SESION_CLOUD.md` |
| Bugs ya resueltos / deuda vigente | `docs/BUGS.md` · `docs/TECH_DEBT.md` |
| Bitácora de cambios (solo escribir) | `docs/historial/` |

## EKP (repo hermano `julietaarrazate/ekp`)

Es de **solo lectura** y solo para decisiones grandes (`engines/decision-engine.md`, `domains/design|ux/`, `engines/review-engine.md`); para un bug o feature normal alcanza `docs/`. **No se escribe en EKP al cerrar una sesión de Oído** (decisión de Julieta, 2026-11-13): la fricción que se va a repetir se deja en este repo, como receta en `docs/reference/SESION_CLOUD.md` o como ítem del tablero o de `docs/STATUS.md`. Si el trabajo *es* EKP, abrir la sesión allá.
