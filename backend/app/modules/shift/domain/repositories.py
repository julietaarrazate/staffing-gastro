"""Puerto del repositorio de turnos."""

from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.domain.value_objects import WorkerSkill


@dataclass
class ShiftPublicationStats:
    """Conteos agregados de `shifts` para `shift_assignment_rate`/
    `shift_completion_rate` (panel de admin) — dos métricas DISTINTAS a
    propósito (docs/audits/ETAPA1_QUALITY_REVIEW.md §1.1):

    - `assigned`: turnos que alguna vez tuvieron `first_assigned_at` seteado
      ("el comercio eligió a alguien", sin importar qué pasó después: un
      turno asignado→no-show→cancelado cuenta acá). Dato interno del embudo:
      NO es «cubierto» (eso es `first_confirmed_at`, ver `ShiftPeriodStats`).
    - `completed`: turnos cuyo `status` ACTUAL es `FINALIZADO` o `PAGADO`
      (`Shift.finish()`/`Shift.mark_paid()`, estados ya existentes del
      dominio — ningún estado nuevo). Mide cobertura real de punta a punta.

    La brecha entre `assigned/published` y `completed/published` es la
    señal útil: cuánto de lo "encontrado" efectivamente se trabajó.
    Calculado con `SUM(CASE...)` en SQL (mismo patrón que `UserCounts` de
    identity), no trayendo filas a Python. Excluye los turnos de las cuentas
    de prueba e invitadas (`exclude_company_emails`) y, de las tres cuentas,
    los que vencieron con la cuenta del comercio suspendida
    (`Shift.not_covered_while_suspended`, ADR-0024)."""

    published: int
    assigned: int
    completed: int


@dataclass
class ShiftPeriodStats:
    """Turnos publicados en un período (`published_at` dentro de la ventana)
    y cuántos de ésos se cubrieron, para "Métricas" con período del panel
    de admin.

    Definiciones (Julieta, 2026-11-17, docs/planning/BETA_TABLERO.md):
    - **cubierto** = la persona confirmó (`first_confirmed_at`), ya no que el
      comercio eligió (`first_assigned_at`).
    - **cumplido** = cubierto y con `check_in_at` (hubo llegada al local).
    - minutos hasta cubrir = `first_confirmed_at - published_at`.
    - **aviso corto** = `start_at - published_at <= 24 h`.

    `avg_minutes_to_cover` y `median_minutes_to_cover` son `None` sin turnos
    cubiertos (nunca un número sobre cero casos).
    `active_companies`: comercios distintos que publicaron en la ventana;
    `companies_with_covered`: de ésos, los que tuvieron al menos un turno
    cubierto.

    Los turnos que vencieron con la cuenta del comercio suspendida
    (`Shift.not_covered_while_suspended`, ADR-0024) quedan fuera de todo
    salvo de `active_companies`, que mide actividad (el comercio publicó) y
    no cobertura."""

    published: int
    covered: int
    covered_under_10_min: int
    avg_minutes_to_cover: float | None
    median_minutes_to_cover: float | None
    short_notice_covered: int
    short_notice_under_10_min: int
    fulfilled: int
    active_companies: int
    companies_with_covered: int


@dataclass
class ShiftReturnStats:
    """«Comercios que vuelven a publicar»: de los comercios cuya primera
    confirmación fue hace al menos `window_days` (`sample_size`: la cohorte
    que ya tuvo la ventana entera), cuántos publicaron otro turno dentro de
    los `window_days` siguientes a esa confirmación (`returned`)."""

    sample_size: int
    returned: int


@dataclass(frozen=True)
class WorkerEarningsTotals:
    """Lo ganado por un trabajador, sumado en la base (sin tope de filas):
    total histórico, cantidad de turnos ganados y lo ganado dentro de la
    ventana pedida (el mes, para el resumen del perfil)."""

    total: Decimal
    count: int
    in_window: Decimal


@dataclass
class ShiftLiveCounts:
    """Totales de "Turnos en vivo" sobre TODOS los turnos sin cubrir (no sobre
    la página que se muestra): total, urgentes, escalados, y las ausencias
    del día argentino."""

    total: int
    urgent: int
    escalated: int
    no_shows: int


@dataclass
class ShiftTodayCounts:
    """Lo que la portada "Hoy" del panel de admin pide mirar ya: turnos
    urgentes todavía sin nadie asignado, y ausencias (no-show) marcadas en
    el día argentino."""

    urgent_uncovered: int
    no_shows_today: int


class ShiftRepository(ABC):
    """Puerto de persistencia para Turno."""

    @abstractmethod
    async def add(self, shift: Shift) -> Shift:
        """Persiste un nuevo turno y lo devuelve."""

    @abstractmethod
    async def update(self, shift: Shift) -> Shift:
        """Actualiza un turno existente y lo devuelve."""

    @abstractmethod
    async def mark_departure_reminder_sent(
        self, shift_id: UUID, worker_profile_id: UUID, sent_at: datetime
    ) -> bool:
        """Registra que se mandó el recordatorio de salida SIN subir la
        `version` del turno (ADR-0016): es una marca del sistema, no una
        decisión de nadie, y no debe invalidar la lectura que tiene el
        cliente (p. ej. quien está por tocar «Confirmar»). Sólo marca si el
        turno sigue asignado o confirmado a esa persona, sin marca previa y sin «Va en
        camino»; devuelve si marcó (si no, no hay que avisar)."""

    @abstractmethod
    async def get_by_id(self, shift_id: UUID) -> Shift | None:
        """Busca un turno por su id."""

    @abstractmethod
    async def companies_with_inactive_account(
        self, company_ids: Sequence[UUID]
    ) -> set[UUID]:
        """De estos comercios, los que tienen la cuenta suspendida (ADR-0024):
        sus turnos abiertos no se muestran a quien no es parte."""

    @abstractmethod
    async def list_by_ids(self, shift_ids: Sequence[UUID]) -> list[Shift]:
        """Trae varios turnos por id en UNA query (`WHERE id IN (...)`).

        Evita el N+1 de red al resolver el detalle de una lista de
        postulaciones: en vez de un GET /shifts/{id} por postulación (cada uno
        pagando el round-trip a la base remota), el cliente pide las
        postulaciones ya con su turno embebido (ver `/applications/mine` y
        `docs/audits/PERFORMANCE_REPORT.md`)."""

    @abstractmethod
    async def list_by_company(
        self, company_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Shift]:
        """Lista los turnos publicados por un comercio (más recientes primero, paginado)."""

    @abstractmethod
    async def list_open(
        self,
        *,
        city: str | None = None,
        position: WorkerSkill | None = None,
        positions: list[WorkerSkill] | None = None,
        urgent: bool | None = None,
        limit: int = 50,
        offset: int = 0,
        nearest_to: tuple[float, float] | None = None,
    ) -> list[Shift]:
        """Lista los turnos abiertos del feed público, con filtros opcionales (paginado).

        Sólo turnos de comercios con la cuenta activa: los de un comercio
        suspendido no se ofrecen (ADR-0024). Va en la misma consulta, para
        que la página salga entera y sin un viaje más a la base.

        `position` filtra por un rubro puntual (override explícito, por
        ejemplo un filtro manual en la UI); `positions` filtra por varios a
        la vez (los rubros que eligió el trabajador en su perfil, para que
        el feed sólo le muestre lo que le sirve — ver `ShiftService.list_feed`).

        Orden: urgentes primero y después los más nuevos. Con `nearest_to`
        (lat, lng), en cambio, del más cercano a ese punto al más lejano
        (distancia aproximada, alcanza para elegir la página; los turnos sin
        coordenadas van al final): es lo que usa Buscar para que el tope de
        la página se llene con lo que queda a mano y no con lo último que se
        publicó en el país.
        """

    @abstractmethod
    async def list_open_unpaged(
        self,
        *,
        city: str | None = None,
        position: WorkerSkill | None = None,
        positions: list[WorkerSkill] | None = None,
        urgent: bool | None = None,
        box: tuple[float, float, float, float] | None = None,
    ) -> list[Shift]:
        """Los turnos abiertos SIN paginar, para quien después decide en
        Python qué queda cerca, ordena y recién ahí corta la página
        (`ShiftService.list_feed`). Cortar antes de filtrar era el problema:
        la página se llenaba con turnos de otra provincia.

        `box` = `(lat_min, lat_max, lng_min, lng_max)` es el filtro grueso
        (ver `app.core.geo.bounding_box`): devuelve los turnos que caen
        adentro MÁS los que no tienen coordenadas, que no se pueden ubicar y
        se resuelven por ciudad. Sin `box`, todos los abiertos.
        Sin comercios suspendidos, como `list_open`.
        """

    @abstractmethod
    async def list_by_worker(
        self, worker_profile_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Shift]:
        """Lista los turnos asignados a un trabajador (más recientes primero, paginado)."""

    @abstractmethod
    async def list_history_by_worker(
        self, worker_profile_id: UUID, *, limit: int = 50
    ) -> list[Shift]:
        """Historial de un trabajador para el panel de admin: los turnos que
        tiene asignados MÁS aquellos donde faltó (`last_no_show_worker_profile_id`),
        que ya no lo tienen como asignado (`no_show()` limpia
        `worker_profile_id`). Más recientes primero."""

    @abstractmethod
    async def sum_worker_earnings(
        self,
        worker_profile_id: UUID,
        statuses: frozenset[ShiftStatus],
        *,
        window_start: datetime,
        window_end: datetime,
    ) -> WorkerEarningsTotals:
        """Suma lo que se paga por los turnos del trabajador en `statuses`
        (el monto prorrateado de un turno reofrecido, si no `pay_amount`:
        misma regla que `Shift.amount_due`), en
        la base y sin tope de filas: total, cantidad y lo que cae en
        `[window_start, window_end)` según `start_at`. Los límites son
        instantes (con zona): quien llama decide a qué hora local cortan."""

    @abstractmethod
    async def list_by_worker_and_statuses(
        self, worker_profile_id: UUID, statuses: frozenset[ShiftStatus]
    ) -> list[Shift]:
        """Turnos de un trabajador en alguno de los estados dados, sin paginar.

        Uso interno (no expuesto por API): detectar solapamiento de horarios
        al confirmar un turno (regla de doble turno, `COMMITTED_STATUSES`)."""

    @abstractmethod
    async def list_by_event(self, company_id: UUID, event_id: UUID) -> list[Shift]:
        """Los puestos de un evento de este comercio, en todos los estados y
        sin paginar (un evento tiene pocos). Vacío si el evento no existe o es
        de otro comercio: quien llama no distingue los dos casos (U084)."""

    @abstractmethod
    async def list_by_company_and_statuses(
        self, company_id: UUID, statuses: frozenset[ShiftStatus]
    ) -> list[Shift]:
        """Turnos de un comercio en alguno de los estados dados, sin paginar.

        Uso interno (no expuesto por API): qué turnos toca la suspensión del
        comercio (ADR-0024)."""

    @abstractmethod
    async def list_awaiting_checkin(self) -> list[Shift]:
        """Turnos CONFIRMADO/EN_CAMINO (todavía sin check-in), sin paginar.

        Uso interno (no expuesto por API): el scheduler de asistencia
        (ADR-0008) los recorre para decidir —comparando `start_at` en
        Python, mismo criterio que `_naive` en `ShiftService` para no
        pelearse con el tz-naive de SQLite en tests— si mandar el
        recordatorio de check-in o marcar no-show automático."""

    @abstractmethod
    async def list_recently_filled(
        self, *, exclude_company_emails: frozenset[str] = frozenset(), limit: int = 500
    ) -> list[Shift]:
        """Turnos con `published_at` Y `first_confirmed_at` seteados (los
        cubiertos: los que aportan dato a la métrica de tiempo de cobertura),
        más recientes primero, acotado a `limit`. Sin los turnos de comercios
        cuyo email está en `exclude_company_emails` (cuentas de prueba e
        invitadas) ni los que vencieron con la cuenta del comercio suspendida
        (`Shift.not_covered_while_suspended`, ADR-0024).

        Uso interno (no expuesto por API): `AdminService.get_stats` calcula
        el promedio y el % cubierto en <10 min sobre esta muestra."""

    @abstractmethod
    async def list_open_awaiting_escalation(self) -> list[Shift]:
        """Turnos abiertos (`OPEN_STATUSES`) con `published_at` seteado y
        todavía sin escalar (`escalated_at` es `None`), sin paginar.

        Uso interno (no expuesto por API): el scheduler los recorre para
        decidir —comparando `published_at` en Python, mismo criterio que el
        resto de los chequeos del scheduler— si ya toca escalar la urgencia
        (`ShiftService.escalate_urgency`). Sin los de comercios suspendidos
        (ADR-0024): están ocultos y escalar avisaría de un turno que nadie ve."""

    @abstractmethod
    async def list_awaiting_coverage_check(self) -> list[Shift]:
        """Turnos en `UNCOVERED_ELIGIBLE_STATUSES` (PUBLICADO/
        BUSCANDO_PERSONAL/ASIGNADO), sin paginar.

        Uso interno (no expuesto por API): el scheduler de "no cubierto"
        (ADR-0015) los recorre para decidir —comparando `start_at` en Python,
        mismo criterio que el resto de los chequeos del scheduler— si ya se
        agotó el período de gracia sin llegar a CONFIRMADO."""

    @abstractmethod
    async def hourly_pay_samples(
        self, pairs: Sequence[tuple[WorkerSkill, str]], *, since: datetime
    ) -> dict[tuple[WorkerSkill, str], list[Decimal]]:
        """Pagos POR HORA de los turnos ya publicados desde `since`, agrupados
        por (puesto, ciudad) — la muestra del pago de referencia (ADR-0012).

        Recibe TODAS las combinaciones de una página y devuelve todas juntas,
        en UNA consulta: si fuera una por combinación, un feed con turnos de
        seis barrios distintos dispararía seis consultas y el costo crecería
        con la variedad de la página. Es la misma disciplina que `list_by_ids`
        (P3, docs/audits/PERFORMANCE_REPORT.md), y hay un test que la fija.

        Devuelve pagos por hora ya normalizados, no montos de turno: los
        turnos duran distinto y comparar el pago de uno de 4 horas contra uno
        de 8 no compara nada.

        La ciudad se compara sin distinguir mayúsculas; las claves del
        resultado vienen con la ciudad en minúsculas.

        Se excluyen los BORRADOR a propósito: un borrador no es una oferta
        del mercado, es una idea a medio escribir. Un turno cancelado sí
        cuenta — se publicó a ese precio, y eso es lo que mide la referencia.
        """

    @abstractmethod
    async def count_publication_stats(
        self, *, exclude_company_emails: frozenset[str] = frozenset()
    ) -> ShiftPublicationStats:
        """Cuenta turnos publicados, asignados y completados
        (`shift_assignment_rate`/`shift_completion_rate`, panel de admin) —
        agregado en SQL, no una lista de filas. Sin los turnos de
        `exclude_company_emails`."""

    @abstractmethod
    async def list_live(self, *, limit: int = 200) -> list[Shift]:
        """Turnos publicados que todavía no tienen a nadie confirmado
        (`UNCOVERED_ELIGIBLE_STATUSES`: PUBLICADO, BUSCANDO_PERSONAL y
        ASIGNADO sin confirmar), para "Turnos en vivo" del panel de admin.

        Ordenados por lo que más apura: urgentes primero, dentro de ellos
        los escalados por el sistema, y después el publicado más reciente
        (si hay más que `limit`, lo que queda afuera es lo más viejo, y la
        pantalla lo avisa con `count_live`). Una sola consulta, acotada."""

    @abstractmethod
    async def count_live(self, *, day_start: datetime, day_end: datetime) -> ShiftLiveCounts:
        """Totales de la lista en vivo (mismo criterio que `list_live`) más
        las ausencias con `no_show_at` en `[day_start, day_end)`, sin el
        tope de `limit`. Una sola consulta con SUM/CASE."""

    @abstractmethod
    async def list_no_shows(
        self, *, day_start: datetime, day_end: datetime, limit: int = 200
    ) -> list[Shift]:
        """Turnos con `no_show_at` en `[day_start, day_end)` (las ausencias de
        hoy de la portada), la más reciente primero. Una consulta, acotada."""

    @abstractmethod
    async def count_today(
        self, *, day_start: datetime, day_end: datetime
    ) -> ShiftTodayCounts:
        """Urgentes sin cubrir (abiertos, `urgent`, con `start_at` en
        `[day_start, day_end)`) y no-shows con
        `no_show_at` en `[day_start, day_end)` — el día de negocio lo arma
        quien llama con `hoy_art()`. Una sola consulta con SUM/CASE."""

    @abstractmethod
    async def count_period_stats(
        self,
        *,
        previous_start: datetime,
        current_start: datetime,
        end: datetime,
        exclude_company_emails: frozenset[str] = frozenset(),
    ) -> tuple[ShiftPeriodStats, ShiftPeriodStats]:
        """`(actual, anterior)`: turnos publicados en `[current_start, end)`
        y en `[previous_start, current_start)`, sin los de comercios cuyo
        email está en `exclude_company_emails`. Los agregados salen de UNA
        consulta (SUM/CASE por ventana) y la mediana de otra, así la
        comparación no suma round-trips según el volumen."""

    @abstractmethod
    async def count_return_stats(
        self,
        *,
        exclude_company_emails: frozenset[str] = frozenset(),
        window_days: int = 30,
        now: datetime | None = None,
    ) -> ShiftReturnStats:
        """Comercios que vuelven a publicar: ver `ShiftReturnStats`. Sin los
        comercios de `exclude_company_emails`."""
