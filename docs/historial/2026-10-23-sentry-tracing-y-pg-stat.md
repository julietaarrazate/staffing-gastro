# Medir la velocidad en producción: tracing de Sentry al 10% y pg_stat_statements

**Pedido:** Julieta, 2026-10-23 ("vamos con todo"), para poder medir el
rendimiento con usuarios reales y no sólo en pruebas locales.

**Qué cambió:**

- Backend: Sentry mide 1 de cada 10 pedidos (`SENTRY_TRACES_SAMPLE_RATE`,
  default `0.1`, en `backend/app/core/config.py`). Antes era 0 y no había
  ningún dato de latencia de producción. Las mediciones pasan por el mismo
  filtro de secretos que los errores (`before_send_transaction`), así un
  `?token=` no llega a Sentry. Tests en `tests/test_observability.py`.
- Neon (producción): `CREATE EXTENSION pg_stat_statements` (hecho el
  2026-10-23, con el OK de Julieta). Registra cuánto tarda cada consulta.
  Los datos se pierden cuando la base se duerme por inactividad.

**Por qué así:** con el cupo gratis de Sentry (millones de mediciones por
mes) el 10% de la beta no cuesta nada. El frontend sigue sin tracing para no
volver a sumar peso al JS.

**Queda abierto:** revisar en unos días las consultas más lentas
(`pg_stat_statements`) y los endpoints más lentos (Sentry → Performance).
