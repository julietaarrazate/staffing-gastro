# Los turnos ocultos de un comercio suspendido vencen sin aviso y fuera de las métricas

**Pedido:** decisión 22 de Julieta (2026-11-18). Los turnos abiertos de un comercio suspendido quedan ocultos (ADR-0024); cuando su horario pasa, vencen igual («no cubierto»), pero sin aviso a la cuenta suspendida y fuera de las métricas de cobertura.

**Qué cambió:** a un comercio suspendido ya no le queda guardado «Un turno quedó sin cubrir» por un turno que estaba oculto, y el panel de admin deja de contar esos turnos en la cobertura.

- Dominio: `Shift.mark_not_covered(company_suspended=...)` guarda la marca `not_covered_while_suspended` (`backend/app/modules/shift/domain/entities.py`).
- Caso de uso: `ShiftService.mark_not_covered` consulta `company_account_active`; con la cuenta suspendida marca el turno y vuelve sin avisar (`backend/app/modules/shift/application/services.py`). El scheduler no cambió: `run_coverage_check` ya recorría esos turnos.
- Base: columna `shifts.not_covered_while_suspended`, booleana, NOT NULL, default falso (`backend/alembic/versions/0055_no_cubierto_con_cuenta_suspendida.py`). Los turnos que ya habían vencido quedan en falso: no se puede saber hacia atrás.
- Métricas (`backend/app/modules/shift/infrastructure/repositories.py`, condición `_counts_for_coverage`), sin los turnos marcados en el numerador y en el denominador:
  - `count_period_stats` («Métricas» de 7 y 30 días): publicados, cubiertos, % cubiertos, % en menos de 10 min, promedio y mediana, aviso corto, cumplidos y «con un turno cubierto».
  - `count_publication_stats`: tasa de asignación y tasa de finalización.
  - `list_recently_filled`: muestra, promedio y % en menos de 10 min del tiempo hasta cubrir.
- No cambian: «Locales activos» (el comercio publicó: es actividad), las ausencias de «Hoy» y «Turnos en vivo» (pasaron de verdad), `count_live` y `count_today` (un turno vencido ya no está en esos estados), «comercios que vuelven a publicar», postulaciones y usuarios.
- Tests: `backend/tests/test_ocultos_vencen.py`.
- Docs: ADR-0024 y ADR-0015 (actualización del 2026-11-18), `docs/reference/NOTIFICATIONS.md`, `docs/foundation/DOMAIN.md`, `docs/reference/QUE_EXISTE_HOY.md`, `docs/reference/OBSERVABILITY.md`.

**Por qué así:** la marca va en el turno y no se mira el estado de la cuenta al calcular, porque la cuenta puede reactivarse después y el turno no tiene que volver a contar. Se consulta la cuenta en `mark_not_covered` y no se filtra en `list_awaiting_coverage_check`, porque el turno tiene que vencer igual. Hasta ahora sólo se cortaba el push (#636) y el aviso en la app se guardaba igual; ahora tampoco se guarda. «Locales activos» sigue contando al comercio suspendido porque mide que publicó, no que se cubrió.

**Queda abierto:** qué muestran «Hoy» y «Turnos en vivo» del admin sobre los turnos ocultos que todavía no vencieron (hoy los cuentan como cualquier turno sin cubrir). «Comercios que vuelven a publicar» sigue mirando los turnos marcados: es retención, no cobertura.
