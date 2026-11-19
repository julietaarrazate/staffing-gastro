# Métricas: la serie semanal M7, con las altas de cada semana por origen y rol

**Pedido:** Julieta, 2026-11-19 (fase 0 del plan de crecimiento, entrega del 13/12): cerrar M7 del tablero de la beta, una serie semanal desde el día 1 de la beta (o un CSV) para la lámina de tracción y el reporte de los lunes (pestaña «Indicadores» del plan), con las altas por origen y por rol.

**Qué cambió:** en Administración → Métricas, debajo del período, la sección **«Semana por semana»**:
- Las últimas 8, 12 o 26 semanas (12 por defecto), de lunes a domingo en hora argentina, la más nueva primero y la de hoy marcada «en curso». Por semana: publicados, cubiertos (con %), cumplidos (con %), mediana hasta confirmar, locales activos, altas de trabajadores y de comercios.
- **«Altas por origen, semana por semana»**: una fila por origen (los que más traen primero, «Sin dato» al final) y una columna por semana; cada celda, trabajadores · comercios.
- **«CSV»** baja la serie de la semana más vieja a la más nueva (como la quiere un gráfico), con los porcentajes, la mediana, el aviso corto y una columna por origen y rol. Archivo `oido-semanas-desde-<lunes>.csv`.

Técnico:
- `GET /admin/weekly-metrics?weeks=1..52` (`admin/api/routes.py`), `AdminService.get_weekly_metrics` y `week_bounds` (`admin/application/periods.py`, semanas de lunes a lunes cortadas a la medianoche argentina), `WeekSummary`/`WeeklyMetrics`.
- `ShiftRepository.count_period_stats` pasa a ser `count_window_stats(windows=[…])`: las mismas columnas SUM/CASE para N ventanas en una consulta, y la mediana en otra. `period-metrics` la usa con dos ventanas, así que las dos pantallas cuentan igual (hay un test que lo compara).
- Las altas de cada semana salen de `count_signups_by_origin` (una consulta corta por semana), sin las cuentas de prueba ni las invitadas.
- Frontend: `components/admin/SerieSemanal.tsx`, `lib/metricas-semanales.ts` (fechas, orden de orígenes, CSV) y `lib/csv.ts`, el armado de CSV que antes vivía en `lib/leads.ts` (ahora lo usan los dos).
- Contrato (#666): escenario `metricas_semanales` en `backend/tests/test_contrato_frontend.py` (las fechas de corte y la mediana quedan fijas en el archivo), el tipo `WeeklyMetrics` en `lib/contrato.test.ts`, y el mock del E2E armado con `deContrato`.
- Si se cambia rápido la cantidad de semanas, sólo vale la respuesta del último pedido (hallazgo de la revisión independiente).
- Tests: `backend/tests/test_metricas_semanales.py` (cortes de semana, el domingo a la noche, cada turno en su semana, igual que el período, altas por origen y rol, consultas constantes, 403 y 422), `lib/metricas-semanales.test.ts` y el E2E de Métricas (tabla, orígenes, CSV descargado y el cambio a 26 semanas).

**Por qué así:** cada turno cuenta en la semana en que se publicó, igual que «Métricas» del período: así una semana y «Últimos 30 días» nunca se contradicen. Semanas de lunes a domingo porque el reporte se arma los lunes con la semana que terminó. La cantidad de semanas se elige (hasta 52) en vez de fijar en el código la fecha de inicio de la beta, que todavía no está; para la lámina «desde el día 1» alcanza con 26. El CSV se arma en el navegador con los mismos datos que se ven: no hace falta otro endpoint. No se agregó un gráfico: el deck lo arma desde el CSV.

**Queda abierto:** los indicadores que la pestaña «Indicadores» marca como «Falta» (postulaciones por turno en la primera hora, trabajadores alcanzables, trabajadores con turno, tiempo de verificación) no entran en la serie; son trabajo aparte si Julieta los pide.
