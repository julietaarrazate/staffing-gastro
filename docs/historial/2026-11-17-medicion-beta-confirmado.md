# Medición de la beta: cubierto = la persona confirmó (M1 a M5)

**Pedido:** Julieta (2026-11-17). Los KRs del trimestre alimentan la lámina de
tracción del deck y lo que no se mide desde el primer turno no se recupera.
Un turno no está cubierto porque el comercio eligió a alguien: falta que la
persona acepte y vaya. Ítems M1 a M5 de «Antes de abrir: medir la beta» en
`docs/planning/BETA_TABLERO.md`.

**Qué cambió:**

- `/admin/metricas`, sección por período: tarjetas con el período anterior al
  lado para «Locales activos», «Turnos cubiertos» (la persona confirmó),
  «Mediana hasta confirmar», «Con menos de 24 h de aviso, en menos de 10 min»
  y «Cumplidos» (% de los cubiertos). Sección general: «Comercios que vuelven
  a publicar (30 días)» reemplaza a «Comercios que repiten»; la promesa de los
  10 minutos se mide hasta la confirmación.
- Definiciones: **cubierto** = `first_confirmed_at` (ya no `first_assigned_at`);
  **cumplido** = cubierto y con `check_in_at`; minutos hasta cubrir =
  `first_confirmed_at - published_at`; **aviso corto** =
  `start_at - published_at <= 24 h`.
- Dominio: `Shift.first_confirmed_at`, que `confirm()` completa sólo la
  primera vez (igual que `first_assigned_at` en `assign()`). Columna nullable
  en `shifts` con la migración `0046_turno_primera_confirmacion.py`, sin
  backfill.
- Cuentas de prueba e invitadas fuera de las métricas de turnos y comercios:
  `AdminService` pasa `GUEST_ACCOUNT_EMAILS | TEST_ACCOUNT_EMAILS` como
  `exclude_company_emails` a `count_period_stats`, `list_recently_filled`,
  `count_publication_stats` y `count_return_stats`
  (`shift/infrastructure/repositories.py`, subconsulta por el email del dueño
  del comercio, mismo patrón que `_from_active_company`). El repo de turnos no
  importa constantes de identity: las recibe.
- `ShiftPeriodStats`, `PeriodSummary` y `period-metrics` suman
  `median_minutes_to_cover`, `short_notice_covered`,
  `short_notice_under_10_min_pct`, `fulfilled`, `fulfilled_pct`,
  `active_companies` y `companies_with_covered`. Los porcentajes salen en el
  servicio con `_rate_pct`: `None` sin muestra.
- `PlatformStats`: `employer_repeat_*` pasa a `employer_return_30d_*`. Un
  comercio entra en la muestra si tiene al menos un turno cubierto; «volvió»
  si publicó otro con `published_at` en (primera confirmación, +30 días].
  Se eliminó `CompanyProfileRepository.count_engagement_stats`.
- Tests: `backend/tests/test_medicion_beta.py` (nuevo) y ajustes en
  `test_admin.py`, `test_admin_vivo_metricas.py` y los specs de Playwright de
  admin.

**Por qué así:**

- Mediana y «vuelven a publicar» se calculan en Python sobre filas: con el
  volumen de la beta alcanza y evita `percentile_cont` (SQLite de los tests no
  lo tiene) y una autounión. Si el volumen crece a decenas de miles de turnos,
  pasar a SQL (comentario en el repo).
- «Elegido por el comercio» queda como dato interno del embudo
  (`shift_assignment_rate_pct`), no como cubierto.
- `check_in_at` no se borra al reabrir un turno: `no_show()` sólo es posible
  antes de la llegada y `worker_cancel()` sólo desde CONFIRMADO. Un cumplido
  cuenta como esté el turno hoy.
- Sin backfill: inventar la hora desde `updated_at` mezclaría datos falsos con
  la medición. Lo confirmado antes de la 0046 no entra en cobertura.
- Mover la mediana y el aviso corto a la sección por período, y dejar la
  general sólo con promedio y % en menos de 10 min, evita mezclar turnos
  publicados con días de anticipación con los de último momento.

**Queda abierto:** M6 (plan elegido y compromiso de pago) y M7 (serie semanal
o CSV para el deck) del tablero. `docs/audits/` conserva las definiciones
viejas (`first_assigned_at`, `employer_repeat_rate`) como registro de la
auditoría del momento.
