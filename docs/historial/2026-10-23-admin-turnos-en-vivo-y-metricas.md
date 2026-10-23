# Panel de admin: Turnos en vivo, "Hoy" con urgencias y Métricas con período

**Pedido:** pasos 3 y 4 del panel de admin ordenado (Julieta, 2026-10-20):
ver los turnos que se están quedando sin cubrir, sumar a "Hoy" los urgentes
y las ausencias del día, y que "Métricas" tenga período y comparación.

**Qué cambió:** tres pantallas del panel.

- **Turnos en vivo** (`/admin/en-vivo`, nueva en el menú, con el número de
  urgentes sin cubrir): los turnos publicados que todavía no tienen a nadie
  confirmado (publicado, buscando personal o asignado sin confirmar). Cada
  uno muestra hace cuánto se publicó (en rojo si pasó los 10 minutos sin
  nadie), comercio, puesto, barrio, horario, si es urgente o lo escaló el
  sistema y cuántas postulaciones tiene. Orden: urgentes, dentro de ellos
  los escalados, y después el que lleva más tiempo esperando. Filtros
  Todos / Urgentes / Escalados (quedan en la dirección, `?filtro=`), y se
  actualiza sola cada 30 s mientras la pestaña está a la vista.
- **Hoy** suma "Turnos de hoy": urgentes sin cubrir y ausencias (no-show)
  marcadas hoy, con acceso a Turnos en vivo.
- **Métricas** arranca con "Últimos 7 días / Últimos 30 días": turnos
  publicados, cubiertos, tiempo hasta cubrir, % cubierto en menos de
  10 min y postulaciones, cada uno con flecha y % contra el período
  anterior (verde si es bueno para el negocio, rojo si es malo; en el
  tiempo hasta cubrir, bajar es bueno). El ingreso mensual queda como foto
  de hoy, sin comparación: no se guarda su historia.

Técnico: `GET /admin/live-shifts`, `GET /admin/today` y
`GET /admin/period-metrics?period=7|30` (`backend/app/modules/admin/`).
Puertos nuevos: `ShiftRepository.list_live`, `count_today`,
`count_period_stats`; `ShiftApplicationRepository.count_active_by_shift_ids`
y `count_created_by_period`. Los dos períodos salen de una sola consulta
por tabla (SUM/CASE por ventana; los minutos hasta cubrir se calculan en
SQL, con `EXTRACT(epoch)` en Postgres y `julianday` en SQLite). Turnos en
vivo hace tres consultas fijas (turnos, comercios, postulaciones), y hay
tests que fijan que la cantidad no crece con los datos. Los cortes de "hoy"
y de los períodos son a la medianoche argentina
(`admin/application/periods.py`, sobre `app/core/tz.py`). Frontend en
`app/admin/en-vivo/`, `components/admin/live.ts` (cuentas, con tests) y
`DeltaStatCard` en `components/admin/AdminStats.tsx`.

**Por qué así:** polling y no WebSocket porque no hay canal de admin y una
pantalla que se mira no lo justifica. El período actual incluye hoy ("los
últimos 7 días"), así que hasta la noche compara un día a medias; se
prefirió eso a esconder el día en curso. Los filtros se aplican en el
backend pero los totales de cada filtro son de la lista completa, para que
las pestañas digan cuántos hay.

**Queda abierto:** nada del pedido. Si el MRR tiene que compararse por
período, hace falta guardar una foto mensual (no existe).
