"""Entidad de dominio Turno (Shift).

Encapsula los datos del turno y las reglas de transición de estado del
ciclo de vida del turno. La validación de horario y las transiciones viven en el dominio.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from enum import Enum
from uuid import UUID, uuid4

from app.core.dt import naive as _naive
from app.core.geo import haversine_km
from app.core.tz import format_desde_art, format_duracion, format_inicio_art
from app.modules.shift.domain.exceptions import (
    AdminCloseNotAllowedError,
    InvalidShiftScheduleError,
    InvalidShiftTransitionError,
    OverlappingShiftError,
    PaymentReportNotAllowedError,
    ShiftNotEditableError,
    WorkerTooFarFromShiftError,
)
from app.modules.shift.domain.cobro import (
    TODAVIA_NO_TERMINO,
    TURNO_CANCELADO,
    TURNO_NO_CUBIERTO,
    YA_CONFIRMASTE_EL_COBRO,
    aun_no_se_puede_avisar,
    puede_avisar_desde,
    ya_paso,
)
from app.modules.shift.domain.mensajes import (
    CIERRE_ADMIN_CAMBIO,
    CIERRE_ADMIN_CIERRE_DEL_COMERCIO,
    CIERRE_ADMIN_NINGUNA_SUSPENDIDA,
    CIERRE_ADMIN_SALIDA_DEL_TRABAJADOR,
    cierre_admin_antes_del_inicio,
    cierre_admin_por_estado,
    no_se_puede,
)
from app.modules.shift.domain.schedule import mismo_instante
from app.modules.shift.domain.value_objects import (
    ADMIN_CHECK_OUT_STATUSES,
    EDITABLE_STATUSES,
    NOT_CANCELLABLE_STATUSES,
    OPEN_STATUSES,
    TAKEN_NOT_STARTED_STATUSES,
    TERMINAL_STATUSES,
    UNCOVERED_ELIGIBLE_STATUSES,
    AdminClosePlan,
    ShiftStatus,
)
from app.modules.worker.domain.value_objects import WorkerSkill

# Cuánto antes del horario pactado se puede marcar llegada. Nada impedía
# marcar "llegué"/"me fui"/pagado en un turno con `start_at` a días de
# distancia — el trabajador (o cualquiera probando la app) podía completar
# el ciclo entero de un turno futuro sin que nadie lo notara (Julieta,
# 2026-08-11, probando como comercio invitado: "que se pueda poner una
# fecha a futuro y que pongan como llegué/me fui/pagado si todavía no llegó
# esa fecha"). `check_out()`/`finish()`/`mark_paid()` no necesitan su propio
# guard: ya dependen de haber pasado por `check_in()` primero.
EARLY_CHECKIN_WINDOW = timedelta(minutes=30)

# Radio máximo entre la posición informada y el local para marcar llegada o
# salida (aprobado por Julieta, 2026-10-14). Si el turno no tiene coordenadas
# no hay contra qué comparar y la marca se acepta como antes.
CHECK_RADIUS_KM = 0.3

# "Va en camino" (2026-09): cuánto antes del turno el trabajador puede empezar
# a compartir dónde está, para que el comercio vea que está llegando (pedido de
# Julieta: "que muestre la ruta del trabajador yendo al local, eso genera
# tranquilidad al comercio").
#
# Dos horas y no más: la ventana ES la protección. La ubicación de una persona
# es dato personal (Ley 25.326), así que sólo se acepta mientras responde la
# pregunta "¿va a llegar?" — ni antes ni después. El guard vive acá, en el
# dominio, y no en la UI: que la única forma de compartir posición pase por
# esta regla es lo que hace auditable la promesa.
EN_ROUTE_WINDOW = timedelta(hours=2)

# «No se presentó» sólo se puede marcar cuando el turno ya empezó (hallazgo
# U079): desde `start_at` + esta tolerancia, la misma tolerancia que la
# puntualidad. Antes se aplicaba sobre un turno confirmado que empezaba mañana y penalizaba sin vuelta atrás. La
# ausencia automática del scheduler (a las 2 h) siempre cae después.
NO_SHOW_EARLIEST_AFTER_START = timedelta(minutes=10)

# Turno reofrecido (U080, ADR-0015 actualizado el 2026-11-18): un turno que
# se reabre cuando ya empezó se vuelve a ofrecer como urgente sólo si le queda
# al menos esto de horario, y sale de la oferta cuando le queda menos
# (decisión 19 de Julieta, subida de 1 a 2 horas el mismo día: nadie toma un
# turno reabierto por una sola hora). Al reabrir con menos, pasa directo a
# «no cubierto»; ya reofrecido, deja de ofrecerse y la pasada de cobertura
# lo cierra si nadie confirmó. Es la única constante de esta regla.
REOFFER_MIN_REMAINING = timedelta(hours=2)

# Cuánto tiene que quedar a la vista, como mínimo, un turno que se reofrece.
# Sin esto, una reapertura con 2 h 00 min 30 s de horario mandaba avisos
# urgentes por un turno que dejaba de ofrecerse a los 30 segundos, y el
# comercio recibía casi juntos «lo reofrecimos» y «quedó sin cubrir»
# (revisión independiente de U080). Se reofrece sólo si le quedan más de
# `REOFFER_MIN_REMAINING + REOFFER_MIN_OFFER_WINDOW`.
REOFFER_MIN_OFFER_WINDOW = timedelta(minutes=15)


class Reapertura(str, Enum):
    """Cómo quedó un turno después de que la persona que lo tenía lo dejó
    (rechazo, cancelación, ausencia, suspensión). Lo devuelven las
    transiciones que reabren, para que el caso de uso sepa qué avisar."""

    # Todavía no empezó: vuelve a buscar personal, como siempre.
    ABIERTO = "abierto"
    # Ya empezó y le queda horario: se reofrece como urgente hasta el final.
    REOFRECIDO = "reofrecido"
    # Ya empezó y le queda menos de `REOFFER_MIN_REMAINING`: «no cubierto».
    SIN_CUBRIR = "sin_cubrir"


@dataclass
class Shift:
    """Raíz de agregado Turno, publicado por un comercio."""

    company_id: UUID
    position: WorkerSkill
    quantity: int
    start_at: datetime
    end_at: datetime
    pay_amount: Decimal

    currency: str = "ARS"
    tips: bool = False
    # "Perso"/comida de personal: común en jornadas full-time gastronómicas,
    # igual que las propinas es un beneficio que atrae al trabajador.
    meal: bool = False
    dress_code: str | None = None
    urgent: bool = False
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    title: str | None = None
    description: str | None = None

    status: ShiftStatus = ShiftStatus.BORRADOR
    worker_profile_id: UUID | None = None

    # "Va en camino": ÚLTIMA posición conocida del trabajador yendo al turno.
    # Se PISA en cada reporte, nunca se acumula — a propósito. El comercio
    # necesita "dónde está ahora y cuánto falta", no por dónde anduvo: sin
    # historial no hay recorrido que filtrar ni que custodiar, y la función
    # queda igual de útil. Se limpia al llegar (`check_in`) y en toda salida
    # que desasigne al trabajador.
    en_route_latitude: float | None = None
    en_route_longitude: float | None = None
    en_route_at: datetime | None = None
    # Cuándo se le avisó al comercio «salió para tu local» en este viaje. No
    # es la posición: sobrevive a que la persona deje de compartir (U072),
    # para que apagar y volver a prender no le mande otro aviso al comercio.
    # Se borra con el viaje (`_clear_en_route`).
    en_route_announced_at: datetime | None = None

    check_in_latitude: float | None = None
    check_in_longitude: float | None = None
    check_in_at: datetime | None = None
    check_out_latitude: float | None = None
    check_out_longitude: float | None = None
    check_out_at: datetime | None = None
    paid_at: datetime | None = None
    # «¿Ya cobraste?» (2026-11-27): lo que dijo la persona asignada de un turno
    # terminado. Registro en el propio turno, como `paid_at`; reglas en
    # `domain/cobro.py`. Los dos pueden estar puestos: avisó que no cobró y
    # después lo confirmó.
    worker_confirmed_paid_at: datetime | None = None
    worker_reported_unpaid_at: datetime | None = None
    # Ticket de soporte que abrió «Todavía no cobré». Sin él, la marca todavía
    # no completó sus avisos: un reintento los termina.
    unpaid_report_ticket_id: UUID | None = None

    # No-show (ADR-0007): registro de auditoría directo en el turno, mismo
    # criterio que `check_in_at`/`check_out_at`. `worker_profile_id` se
    # limpia al reabrir la búsqueda (igual que `worker_cancel`/`reject`), así
    # que sin este campo se perdería quién fue marcado ausente.
    no_show_at: datetime | None = None
    last_no_show_worker_profile_id: UUID | None = None

    # «Cerrar turno» de la admin (decisión 21, ADR-0024): cuándo y quién
    # marcó la salida o cerró el turno en nombre de una cuenta suspendida.
    # Registro en el propio turno, como `no_show_at`: la marca de salida
    # (`check_out_at`) no dice quién la hizo.
    closed_by_admin_at: datetime | None = None
    closed_by_admin_user_id: UUID | None = None

    # Scheduler de asistencia (ADR-0008): cuándo se le mandó al trabajador el
    # recordatorio push de "marcá tu llegada". Sin este campo el scheduler
    # reenviaría el mismo push en cada tick mientras el turno siga sin
    # check-in (no hay forma de consultar el historial de `Notification`: esa
    # entidad no tiene shift_id, ver notification/domain/entities.py).
    checkin_reminder_sent_at: datetime | None = None
    # Puntualidad real (ADR-0008 act. 2026-11-26): cuántos de los tres
    # recordatorios de llegada ya salieron (`punctuality.recordatorio_pendiente`).
    checkin_reminder_step: int = 0
    # La llegada la marcó el comercio («Ya llegó») porque la persona no la
    # marcó: cuándo lo hizo y qué dijo, a horario (`True`) o tarde (`False`).
    # `None` si la marcó la persona, que es lo normal.
    arrival_marked_by_company_at: datetime | None = None
    arrival_on_time: bool | None = None

    # "Va en camino": cuándo se le recordó al trabajador que avise al salir
    # (`DEPARTURE_REMINDER_LEAD` antes del inicio). Mismo motivo que el campo
    # de arriba: sin él, el scheduler lo reenviaría en cada pasada.
    departure_reminder_sent_at: datetime | None = None

    # Cierre automático (ADR-0008, decisión 24): un turno con la salida
    # marcada que el comercio no cierra. `finish_reminder_sent_at` es cuándo
    # se le recordó al comercio que lo cierre (`FINISH_REMINDER_DELAY` desde
    # `check_out_at`); marca de sistema, la escribe el repositorio sin subir
    # la versión, como la de arriba. `auto_finished_at` es cuándo lo cerró
    # Oído solo (`AUTO_FINISH_DELAY`); `None` si lo cerró el comercio.
    finish_reminder_sent_at: datetime | None = None
    auto_finished_at: datetime | None = None

    # Reconfirmación antes del turno (ADR-0031, P3), de quien lo tiene ahora:
    # cuándo se le preguntó (a las 24 y a las 3 horas), cuándo contestó «Sí,
    # voy» y cuándo se le avisó al comercio que no contestó. Marcas de
    # sistema: las escribe el repositorio sin subir la versión, y se borran
    # cuando el turno cambia de persona. Las reglas, en `reconfirmacion.py`.
    reconfirm_24h_sent_at: datetime | None = None
    reconfirm_3h_sent_at: datetime | None = None
    reconfirmed_at: datetime | None = None
    no_reconfirm_alert_sent_at: datetime | None = None

    # Publicación masiva para un evento (ej. una boda que necesita 3 mozos +
    # 2 bartenders): cada rol sigue siendo un turno propio con quantity=1
    # (ADR-0003 no se toca), pero comparten `event_id` para poder agruparlos
    # y ver el progreso de cobertura juntos (`ShiftService.create_event`).
    event_id: UUID | None = None
    event_name: str | None = None

    # Métrica de la promesa central del negocio ("cubrir un puesto en menos
    # de 10 minutos", PRODUCT.md): `published_at` marca cuándo se publicó, y
    # `first_assigned_at` cuándo se encontró el primer candidato — sólo la
    # PRIMERA vez (`assign()` no lo pisa en reasignaciones tras rechazo/
    # no-show, para no mezclar "cuánto tardó el matching" con "cuántas veces
    # se tuvo que reintentar"). Dato interno del embudo: desde 2026-11-17 la
    # promesa se mide hasta `first_confirmed_at` (ver abajo). Panel admin:
    # `AdminService.get_stats`.
    published_at: datetime | None = None
    first_assigned_at: datetime | None = None
    # Cuándo confirmó la persona por primera vez (`confirm()`, sólo la primera
    # vez, igual que `first_assigned_at`). Define «cubierto» en las métricas de
    # la beta (Julieta, 2026-11-17): un turno está cubierto cuando alguien
    # confirmó, no cuando el comercio eligió. Sin backfill: los turnos
    # confirmados antes de la migración 0046 no la tienen.
    first_confirmed_at: datetime | None = None

    # Escalada automática de urgencia: si un turno abierto (PUBLICADO/
    # BUSCANDO_PERSONAL) no se cubre rápido, el scheduler lo marca `urgent`
    # (sube al principio del feed, ver `ShiftRepository.list_open`) y avisa a
    # un círculo más amplio de candidatos. `escalated_at` marca cuándo pasó,
    # para que sólo ocurra una vez por turno (`ShiftService.escalate_urgency`).
    escalated_at: datetime | None = None

    # Turno reofrecido (U080): cuándo se volvió a ofrecer un turno que se
    # reabrió con el horario ya empezado. Mientras esté, el turno se ofrece
    # hasta `offered_until` (no hasta `start_at`) y quien lo tome cobra lo que resta
    # desde que llega. No se borra: queda como marca del turno. Si se reabre
    # otra vez, se pisa con la hora del ciclo nuevo.
    reoffered_at: datetime | None = None
    # Cuándo confirmó la persona que tiene el turno AHORA (a diferencia de
    # `first_confirmed_at`, que es de la primera y no se pisa). Se borra al
    # reabrir. Para quien confirma un turno ya empezado, el recordatorio de
    # llegada y la ausencia se cuentan desde acá (`expected_from`).
    confirmed_at: datetime | None = None
    # Lo que se paga por un turno reofrecido: la parte de `pay_amount` que
    # corresponde al horario que resta desde la llegada del reemplazo
    # (decisiones 16 y 18). Queda fijo al marcar la llegada; `None` en todo
    # turno que no se reofreció (se paga `pay_amount`). Ver `amount_due`.
    prorated_pay_amount: Decimal | None = None
    # El turno venció («no cubierto») con la cuenta del comercio suspendida
    # (ADR-0024, actualización 2026-11-18): estaba oculto, nadie pudo
    # postularse, así que queda fuera de las métricas de cobertura. Se guarda
    # en el turno, y no se mira el estado de la cuenta al calcular, porque la
    # cuenta puede reactivarse después y el turno no tiene que volver a contar.
    not_covered_while_suspended: bool = False

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    # Versión del agregado (ADR-0016, bloqueo optimista): la que tenía el
    # turno cuando se leyó. Guardarlo exige que en la base siga siendo esa;
    # si otro la cambió en el medio, `ShiftConcurrentModificationError`.
    # La maneja el repositorio; el dominio sólo la transporta.
    version: int = 1

    def __post_init__(self) -> None:
        self._validate_schedule()

    def _validate_schedule(self) -> None:
        if self.end_at <= self.start_at:
            raise InvalidShiftScheduleError(
                "El turno tiene que terminar después de empezar."
            )

    @property
    def is_editable(self) -> bool:
        """¿El comercio puede corregirlo? Mientras nadie esté comprometido:
        en borrador, publicado, o reabierto sin persona asignada. Con alguien
        asignado o confirmado no se edita (esa persona organizó su día con
        estos datos). Tampoco un turno reofrecido ya empezado."""
        if self.status in EDITABLE_STATUSES:
            return True
        return (
            self.status == ShiftStatus.BUSCANDO_PERSONAL
            and self.worker_profile_id is None
            and self.reoffered_at is None
        )

    def cambio_importante(
        self, *, start_at: datetime, end_at: datetime, pay_amount: Decimal
    ) -> bool:
        """¿Cambiar a estos datos le cambia el trato a quien ya se postuló?
        El horario, o el pago hacia abajo. Subir el pago o tocar la
        descripción no: nadie se retiraría por eso."""
        # Se comparan instantes, no relojes: la base guarda en UTC y la app
        # manda la hora argentina con su offset. Recortar la zona daba por
        # cambiado un horario igual, y por igual uno corrido justo 3 horas.
        return (
            not mismo_instante(self.start_at, start_at)
            or not mismo_instante(self.end_at, end_at)
            or Decimal(pay_amount) < Decimal(self.pay_amount)
        )

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_STATUSES

    def ensure_editable(self) -> None:
        if not self.is_editable:
            raise ShiftNotEditableError("Este turno ya no se puede editar.")

    @property
    def was_published(self) -> bool:
        """¿Estuvo alguna vez a la vista de quien no es parte?

        Decide qué responde la página pública cuando el turno ya no está
        abierto: «ya no disponible» si fue público, «no existe» si nunca lo
        fue. A todo estado que no sea BORRADOR se llega pasando por PUBLICADO,
        menos a CANCELADO, que también se alcanza desde el borrador: ahí
        decide `published_at`. (Los turnos anteriores a ese campo no lo
        tienen; un cancelado de esos queda como «no existe», que es lo que
        menos revela.)"""
        if self.published_at is not None:
            return True
        return self.status not in (ShiftStatus.BORRADOR, ShiftStatus.CANCELADO)

    def is_open_for_applications(self, now: datetime) -> bool:
        """¿Se puede ofrecer para postularse en `now`? Es la regla del Inicio
        (`ShiftRepository.list_open`): estado abierto y hora de inicio todavía
        por delante. Un turno que ya empezó sigue en PUBLICADO o
        BUSCANDO_PERSONAL hasta que el scheduler lo resuelve como «no
        cubierto» (ADR-0015), pero nadie puede llegar a tiempo.

        La excepción es el turno reofrecido (U080): se reabrió con el horario
        ya empezado, así que se ofrece hasta `offered_until` (mientras le
        quede al menos `REOFFER_MIN_REMAINING` de horario)."""
        if self.status not in OPEN_STATUSES:
            return False
        if _naive(self.start_at) > _naive(now):
            return True
        return self.is_reoffered and _naive(self.offered_until) > _naive(now)

    @property
    def is_reoffered(self) -> bool:
        """¿Se volvió a ofrecer con el horario ya empezado (U080)?"""
        return self.reoffered_at is not None

    @property
    def offered_until(self) -> datetime:
        """Hasta cuándo se ofrece un turno reofrecido (U080): mientras le
        quede al menos `REOFFER_MIN_REMAINING` de horario. Desde ahí deja de
        verse y de aceptar postulaciones, y si nadie confirmó la pasada de
        cobertura lo cierra (`coverage_deadline`)."""
        return self.end_at - REOFFER_MIN_REMAINING

    @property
    def taken_after_start(self) -> bool:
        """¿Quien lo tiene ahora es el reemplazo de un turno reofrecido, que
        confirmó con el turno ya empezado?

        Sólo en un turno **reofrecido** (U080). En un turno común, confirmar
        después del inicio (lo asignaron antes de empezar o durante la gracia
        de «no cubierto» y confirmó tarde) no cambia nada: se lo espera desde
        el inicio, su puntualidad se mide contra el inicio y la ausencia corre
        desde ahí, como antes de U080."""
        return (
            self.is_reoffered
            and self.confirmed_at is not None
            and _naive(self.confirmed_at) > _naive(self.start_at)
        )

    @property
    def expected_from(self) -> datetime:
        """Desde cuándo se espera a la persona: el inicio del turno o, si es
        el reemplazo de un turno reofrecido (`taken_after_start`), el momento
        en que confirmó. Es la
        referencia del recordatorio de llegada y de la ausencia (ADR-0008,
        actualización 2026-11-18): a quien toma un turno a las 21:10 no se le
        puede contar la ausencia desde las 20:00."""
        if self.taken_after_start:
            assert self.confirmed_at is not None
            return self.confirmed_at
        return self.start_at

    @property
    def amount_due(self) -> Decimal:
        """Lo que se paga por este turno: el monto prorrateado si es un
        turno reofrecido con la llegada marcada, si no el publicado. Es la
        referencia: la ficha del admin lo lee directo, y tiene dos espejos
        que repiten la regla y hay que cambiar con ella: el `COALESCE` de
        `sum_worker_earnings` (ganancias, en SQL) y `payView` en
        `frontend/lib/pay.ts` (pantallas, con los campos de la API)."""
        if self.prorated_pay_amount is not None:
            return self.prorated_pay_amount
        return self.pay_amount

    @property
    def hourly_pay_amount(self) -> Decimal | None:
        """Valor por hora de un turno reofrecido que todavía no tiene el
        monto fijado (nadie marcó la llegada): es lo que se le muestra a quien
        lo va a tomar, porque el total depende de cuándo llegue. `None` en
        cualquier otro turno: ahí se muestra el monto."""
        if not self.is_reoffered or self.prorated_pay_amount is not None or self.is_terminal:
            return None
        hours = Decimal(
            (_naive(self.end_at) - _naive(self.start_at)).total_seconds()
        ) / Decimal(3600)
        return (self.pay_amount / hours).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

    def overlaps(self, other: "Shift") -> bool:
        """True si el horario de este turno se solapa con el de `other`.

        Intervalos semiabiertos: si uno termina justo cuando el otro empieza
        no se consideran solapados (un turno puede terminar a las 23 y el
        siguiente empezar a las 23 sin conflicto)."""
        return self.start_at < other.end_at and other.start_at < self.end_at

    # --- Transiciones de estado ---
    def publish(self) -> None:
        """BORRADOR → PUBLICADO. Arranca el reloj de la métrica de cobertura
        (`published_at`, ver arriba)."""
        self._transition(ShiftStatus.BORRADOR, ShiftStatus.PUBLICADO, "publicar")
        self.published_at = datetime.now(timezone.utc)

    def start_searching(self) -> None:
        """PUBLICADO → BUSCANDO_PERSONAL."""
        self._transition(
            ShiftStatus.PUBLICADO, ShiftStatus.BUSCANDO_PERSONAL, "buscar"
        )

    @property
    def admits_assignment(self) -> bool:
        """¿El turno está en un estado desde el que se puede asignar a alguien?
        Es la misma condición que exige `assign` (sólo lectura, para que los
        casos de uso la consulten sin duplicarla)."""
        return self.status in (ShiftStatus.PUBLICADO, ShiftStatus.BUSCANDO_PERSONAL)

    @property
    def reconfirmation_pending(self) -> bool:
        """¿Se le preguntó si sigue yendo y todavía no contestó? Sólo con el
        turno confirmado: una vez en camino, la pregunta ya no corre."""
        if self.status != ShiftStatus.CONFIRMADO:
            return False
        avisos = [
            _naive(f)
            for f in (self.reconfirm_24h_sent_at, self.reconfirm_3h_sent_at)
            if f is not None
        ]
        if not avisos:
            return False
        return self.reconfirmed_at is None or _naive(self.reconfirmed_at) < max(avisos)

    def assign(self, worker_profile_id: UUID) -> None:
        """PUBLICADO/BUSCANDO_PERSONAL → ASIGNADO: el comercio elige un candidato.

        Métrica de cobertura: `first_assigned_at` sólo se completa la
        PRIMERA vez (no se pisa en una reasignación posterior a un
        rechazo/no-show) — mide cuánto tardó el matching en encontrar UN
        candidato, no cuántas veces hizo falta reintentar."""
        if not self.admits_assignment:
            raise InvalidShiftTransitionError(
                no_se_puede("asignar", self.status)
            )
        self.worker_profile_id = worker_profile_id
        self.status = ShiftStatus.ASIGNADO
        if self.first_assigned_at is None:
            self.first_assigned_at = datetime.now(timezone.utc)

    def confirm(self, other_committed_shifts: list["Shift"] | None = None) -> None:
        """ASIGNADO → CONFIRMADO: el trabajador asignado confirma su asistencia.

        Regla de doble turno: antes de confirmar, si el trabajador ya tiene
        otro turno propio en un estado "comprometido" (`COMMITTED_STATUSES`
        — CONFIRMADO, EN_CAMINO o trabajando) cuyo horario se solapa con
        éste, se rechaza la confirmación. `other_committed_shifts` lo arma
        `ShiftService.confirm_assignment` consultando el repo (cruce de
        módulo vía puerto, no vive acá la consulta)."""
        for other in other_committed_shifts or []:
            if self.overlaps(other):
                raise OverlappingShiftError(
                    "Ya tenés un turno confirmado que se superpone con este horario."
                )
        self._transition(ShiftStatus.ASIGNADO, ShiftStatus.CONFIRMADO, "confirmar")
        now = datetime.now(timezone.utc)
        # De quien lo tiene ahora (se borra al reabrir): la referencia de su
        # asistencia si confirmó con el turno ya empezado (`expected_from`).
        self.confirmed_at = now
        # Sólo la primera confirmación: si después la persona cancela y otra
        # confirma, el tiempo hasta cubrir sigue siendo el de la primera vez.
        if self.first_confirmed_at is None:
            self.first_confirmed_at = now

    def _reopen(self, now: datetime | None = None) -> Reapertura:
        """El paso común de toda transición en la que la persona que tenía
        el turno lo deja (`reject`, `worker_cancel`, `release_worker`,
        `no_show`): libera el puesto y decide cómo sigue según la hora (U080).

        - Todavía no empezó: vuelve a BUSCANDO_PERSONAL, como siempre.
        - Ya empezó y le queda al menos `REOFFER_MIN_REMAINING` de horario:
          vuelve a BUSCANDO_PERSONAL **reofrecido como urgente**. Se ofrece
          hasta `offered_until` (`is_open_for_applications`). `escalated_at` se marca
          si no lo estaba: el aviso urgente sale con la reapertura, y la
          escalada no tiene que mandarlo otra vez.
        - Ya empezó y le queda menos: NO_CUBIERTO en la misma operación
          (decisión 19), guardando quién lo tenía igual que
          `mark_not_covered`.

        Las marcas de la persona que se va se borran con ella: su
        confirmación y el recordatorio de llegada, para que al reemplazo
        también le llegue el suyo."""
        now = now or datetime.now(timezone.utc)
        leaving = self.worker_profile_id
        self.worker_profile_id = None
        self.status = ShiftStatus.BUSCANDO_PERSONAL
        self.confirmed_at = None
        self.checkin_reminder_sent_at = None
        self.checkin_reminder_step = 0
        self.arrival_marked_by_company_at = None
        self.arrival_on_time = None
        self.reconfirm_24h_sent_at = None
        self.reconfirm_3h_sent_at = None
        self.reconfirmed_at = None
        self.no_reconfirm_alert_sent_at = None
        self._clear_en_route()
        if _naive(now) < _naive(self.start_at):
            return Reapertura.ABIERTO
        if _naive(self.end_at) - _naive(now) > REOFFER_MIN_REMAINING + REOFFER_MIN_OFFER_WINDOW:
            self.reoffered_at = now
            self.urgent = True
            if self.escalated_at is None:
                self.escalated_at = now
            return Reapertura.REOFRECIDO
        if leaving is not None:
            self.last_no_show_worker_profile_id = leaving
        self.status = ShiftStatus.NO_CUBIERTO
        return Reapertura.SIN_CUBRIR

    def reject(self, now: datetime | None = None) -> Reapertura:
        """ASIGNADO → BUSCANDO_PERSONAL: el trabajador asignado rechaza el
        turno. Si ya había empezado, ver `_reopen`."""
        if self.status != ShiftStatus.ASIGNADO:
            raise InvalidShiftTransitionError(
                no_se_puede("rechazar", self.status)
            )
        return self._reopen(now)

    @property
    def is_cancellable(self) -> bool:
        """¿El comercio todavía puede cancelarlo? No si es terminal ni si el
        trabajador ya marcó la salida (U081): ese turno se trabajó entero."""
        return self.status not in NOT_CANCELLABLE_STATUSES

    def cancel(self) -> None:
        """Cancela el turno (comercio, terminal). Desde cualquier estado no
        terminal salvo CHECK_OUT: con la salida marcada el turno ya se
        trabajó, así que el comercio lo finaliza y lo paga; un problema va
        por soporte (U081, ADR-0007, actualización 2026-11-18)."""
        if not self.is_cancellable:
            raise InvalidShiftTransitionError(
                no_se_puede("cancelar", self.status)
            )
        self.status = ShiftStatus.CANCELADO
        self._clear_en_route()

    def worker_cancel(self, now: datetime | None = None) -> Reapertura:
        """CONFIRMADO → BUSCANDO_PERSONAL: el trabajador cancela su asignación ya
        confirmada (ADR-0004).

        A diferencia de `cancel()` (cancelación del comercio, terminal), esta
        transición **reabre** el turno: el comercio sigue necesitando cubrir el
        puesto, así que vuelve al estado de búsqueda abierta y pierde el
        trabajador asignado. Sólo alcanzable desde `CONFIRMADO` — antes de
        confirmar, el trabajador ya puede `reject()`; después de hacer
        check-in, cancelar sería abandono (fuera de alcance, ver TECH_DEBT.md).
        Si el turno ya había empezado, ver `_reopen` (U080).
        """
        if self.status != ShiftStatus.CONFIRMADO:
            raise InvalidShiftTransitionError(
                no_se_puede("cancelar_asistencia", self.status)
            )
        return self._reopen(now)

    def release_worker(self, now: datetime | None = None) -> Reapertura:
        """ASIGNADO/CONFIRMADO/EN_CAMINO → BUSCANDO_PERSONAL: la persona
        asignada ya no puede tomar el turno porque su cuenta se suspendió
        (ADR-0024, punto 5).

        Reabre igual que `worker_cancel()`, pero no lo decidió nadie del
        turno: el caso de uso no le suma una cancelación a nadie. Sólo antes
        de la llegada (`TAKEN_NOT_STARTED_STATUSES`): un turno que ya empezó
        no se toca."""
        if self.status not in TAKEN_NOT_STARTED_STATUSES:
            raise InvalidShiftTransitionError(no_se_puede("liberar", self.status))
        return self._reopen(now)

    def no_show(self, now: datetime | None = None) -> Reapertura:
        """CONFIRMADO/EN_CAMINO → BUSCANDO_PERSONAL: el comercio marca que el
        trabajador asignado no se presentó (ADR-0007).

        Sólo alcanzable **antes** del check-in: una vez que el trabajador
        marcó su llegada, ya se presentó — un abandono después de eso es un
        problema distinto (fuera de alcance, igual que documentaba
        ADR-0004). A diferencia de `cancel()` (comercio, terminal), reabre el
        turno igual que `worker_cancel()`: el comercio sigue necesitando
        cubrir el puesto. Conserva quién fue el ausente en
        `last_no_show_worker_profile_id` antes de limpiar `worker_profile_id`
        (que se libera para poder reasignar), para dejar rastro auditable en
        el propio turno.

        Sólo desde `NO_SHOW_EARLIEST_AFTER_START` después del inicio: antes,
        el trabajador todavía puede llegar. Si la persona confirmó con el
        turno ya empezado (un reemplazo, U080), la tolerancia se cuenta desde
        que confirmó (`expected_from`).

        Una ausencia siempre cae con el turno empezado: cómo sigue (se
        reofrece o queda sin cubrir) lo decide `_reopen`."""
        if self.status not in (ShiftStatus.CONFIRMADO, ShiftStatus.EN_CAMINO):
            raise InvalidShiftTransitionError(
                no_se_puede("no_se_presento", self.status)
            )
        now = now or datetime.now(timezone.utc)
        habilitado = _naive(self.expected_from) + NO_SHOW_EARLIEST_AFTER_START
        if _naive(now) < habilitado:
            desde = (
                "que confirmó el reemplazo"
                if self.taken_after_start
                else "que empieza el turno"
            )
            raise InvalidShiftTransitionError(
                "Todavía no podés marcar que no se presentó: se habilita "
                f"{format_desde_art(habilitado, now)}, "
                f"{format_duracion(NO_SHOW_EARLIEST_AFTER_START)} después de "
                f"{desde}."
            )
        self.no_show_at = now
        self.last_no_show_worker_profile_id = self.worker_profile_id
        return self._reopen(now)

    def mark_not_covered(self, *, company_suspended: bool = False) -> None:
        """PUBLICADO/BUSCANDO_PERSONAL/ASIGNADO → NO_CUBIERTO (ADR-0015):
        el sistema resuelve solo un turno cuyo período de gracia después de
        `start_at` se agotó sin llegar a CONFIRMADO.

        A diferencia de `cancel()` y `no_show()`, **nadie decide esto**: no
        hay comercio ni trabajador detrás, así que no hay reputación que
        tocar ni notificación de "te cancelaron" que mandar — el mensaje real
        es "se acabó el tiempo", no "alguien hizo algo". Tampoco reabre como
        `no_show()`/`worker_cancel()`: para cuando se dispara, `start_at` ya
        quedó atrás y no hay más ventana en la que alguien pueda cubrirlo, así
        que es terminal, no un regreso a `BUSCANDO_PERSONAL`.

        Conserva quién estaba asignado (si lo había) en
        `last_no_show_worker_profile_id`, mismo campo que usa `no_show()` para
        dejar rastro de quién no llegó a confirmar — aunque acá, otra vez, sin
        que eso cuente en contra de nadie.

        `company_suspended`: la cuenta del comercio estaba suspendida cuando
        venció (el turno estaba oculto, ADR-0024). Queda anotado en
        `not_covered_while_suspended` para dejarlo fuera de las métricas de
        cobertura, también si la cuenta se reactiva después."""
        if self.status not in UNCOVERED_ELIGIBLE_STATUSES:
            raise InvalidShiftTransitionError(
                no_se_puede("no_cubierto", self.status)
            )
        if self.worker_profile_id is not None:
            self.last_no_show_worker_profile_id = self.worker_profile_id
        self.worker_profile_id = None
        self.status = ShiftStatus.NO_CUBIERTO
        self.not_covered_while_suspended = company_suspended
        self._clear_en_route()

    def depart(self) -> None:
        """CONFIRMADO → EN_CAMINO: el trabajador sale hacia el turno.

        Paso opcional (ADR-0008): el flujo nuevo va directo de CONFIRMADO a
        CHECK_IN sin pasar por acá. Se conserva sólo por compatibilidad con
        turnos que ya estaban en EN_CAMINO al desplegar el cambio — la UI
        actual no ofrece este botón."""
        self._transition(ShiftStatus.CONFIRMADO, ShiftStatus.EN_CAMINO, "salir")

    def report_en_route_location(self, latitude: float, longitude: float) -> None:
        """El trabajador asignado comparte dónde está mientras viaja al turno.

        Sostiene el "va en camino" que ve el comercio. Tres guards, y los tres
        son de privacidad antes que de negocio:

        1. **Estado**: sólo CONFIRMADO o EN_CAMINO. Antes de confirmar no hay
           viaje que reportar, y una vez hecho el check-in la persona ya llegó:
           seguir recibiendo su posición sería rastrearla en el trabajo, que es
           otra cosa completamente distinta de la que se pidió.
        2. **Ventana**: `EN_ROUTE_WINDOW` antes del inicio pactado. Compartir
           ubicación un día antes no responde ninguna pregunta útil.
        3. **Turno vivo**: nunca en un estado terminal.

        No acumula: cada reporte pisa al anterior (ver los campos `en_route_*`).
        """
        if self.status not in (ShiftStatus.CONFIRMADO, ShiftStatus.EN_CAMINO):
            raise InvalidShiftTransitionError(
                no_se_puede("compartir_ubicacion", self.status)
            )
        now = datetime.now(timezone.utc)
        habilitado = _naive(self.start_at) - EN_ROUTE_WINDOW
        if _naive(now) < habilitado:
            raise InvalidShiftTransitionError(
                "Todavía falta para el turno: podés compartir tu ubicación "
                f"{format_desde_art(habilitado, now)} "
                f"({format_duracion(EN_ROUTE_WINDOW)} antes de que empiece)."
            )
        self.en_route_latitude = latitude
        self.en_route_longitude = longitude
        self.en_route_at = now

    def stop_en_route(self) -> bool:
        """El trabajador deja de compartir su ubicación (U072, ADR-0014
        actualizado el 2026-11-18): la última posición se borra **en el
        momento**, también para el comercio, que vuelve a ver «Confirmado».

        Antes «Dejar de compartir» sólo dejaba de mandar posiciones nuevas: la
        última seguía guardada y a la vista del comercio hasta la llegada.
        Apagar es apagar: el dato deja de existir cuando la persona lo decide.

        Un turno que estaba en EN_CAMINO (el paso viejo `depart`, ADR-0008)
        vuelve a CONFIRMADO. El recordatorio de salida y el aviso ya mandado
        al comercio no se tocan: el viaje no terminó, sólo dejó de verse.
        Devuelve si había algo que apagar (apagar dos veces no es un error)."""
        was_sharing = self.en_route_at is not None or self.status == ShiftStatus.EN_CAMINO
        if self.status == ShiftStatus.EN_CAMINO:
            self.status = ShiftStatus.CONFIRMADO
        self.en_route_latitude = None
        self.en_route_longitude = None
        self.en_route_at = None
        return was_sharing

    def _clear_en_route(self) -> None:
        """Borra la última posición compartida.

        Se llama en cada salida del "va en camino": al llegar y en toda
        transición que desasigne al trabajador. El dato deja de existir apenas
        deja de tener propósito — no queda esperando a que algo lo limpie
        después.

        El recordatorio de salida va con el viaje: si el turno se reabre y lo
        toma otra persona, a ella también le toca que se lo recuerden."""
        self.en_route_latitude = None
        self.en_route_longitude = None
        self.en_route_at = None
        self.en_route_announced_at = None
        self.departure_reminder_sent_at = None

    def _ensure_at_venue(self, latitude: float, longitude: float, action: str) -> None:
        """Rechaza la marca si la posición está a más de `CHECK_RADIUS_KM` del
        local. Sin coordenadas en el turno no se puede verificar: se acepta."""
        distance_km = haversine_km(latitude, longitude, self.latitude, self.longitude)
        if distance_km is None or distance_km <= CHECK_RADIUS_KM:
            return
        meters = round(distance_km * 1000)
        raise WorkerTooFarFromShiftError(
            f"Tenés que estar en el local para marcar {action} (estás a {meters} metros)."
        )

    def check_in(self, latitude: float, longitude: float) -> None:
        """CONFIRMADO/EN_CAMINO → CHECK_IN: el trabajador llega y marca su
        ubicación.

        ADR-0008: antes exigía pasar por `depart()` (EN_CAMINO) primero — se
        saca del flujo normal (4 pasos manuales bajaban la adhesión y subían
        los falsos "no show" de gente que sí llegó pero se olvidó de tocar
        "Salir hacia el turno"). Ahora se puede marcar llegada directo desde
        CONFIRMADO; se sigue aceptando EN_CAMINO para no romper turnos que
        ya estaban a mitad de camino."""
        if self.status not in (ShiftStatus.CONFIRMADO, ShiftStatus.EN_CAMINO):
            raise InvalidShiftTransitionError(
                no_se_puede("llegada", self.status)
            )
        now = datetime.now(timezone.utc)
        habilitado = _naive(self.start_at) - EARLY_CHECKIN_WINDOW
        if _naive(now) < habilitado:
            raise InvalidShiftTransitionError(
                "Todavía no podés marcar tu llegada: se habilita "
                f"{format_desde_art(habilitado, now)} "
                f"({format_duracion(EARLY_CHECKIN_WINDOW)} antes de que "
                "empiece el turno)."
            )
        if self.is_reoffered and _naive(now) >= _naive(self.end_at):
            # Reofrecido (U080): se paga lo que resta desde la llegada, y ya
            # no resta nada.
            raise InvalidShiftTransitionError(
                "Este turno ya terminó: no se puede marcar la llegada."
            )
        self._ensure_at_venue(latitude, longitude, "la llegada")
        self.status = ShiftStatus.CHECK_IN
        self.check_in_latitude = latitude
        self.check_in_longitude = longitude
        self.check_in_at = now
        if self.is_reoffered:
            self.prorated_pay_amount = self._prorated_from(now)
        self._clear_en_route()

    def company_check_in(self, on_time: bool, now: datetime | None = None) -> None:
        """CONFIRMADO/EN_CAMINO → CHECK_IN: el comercio dice que la persona ya
        llegó, a horario o tarde, porque ella no marcó la llegada (puntualidad
        real, ADR-0008 act. 2026-11-26). Así un olvido no termina en una
        ausencia, y una demora no se esconde.

        Sólo desde la hora en que se la espera: antes, todavía la puede marcar
        ella. Sin ubicación: el comercio da fe. `check_in_at` es cuándo lo
        marcó el comercio, no cuándo llegó la persona; para la puntualidad
        vale `arrival_on_time`."""
        if self.status not in (ShiftStatus.CONFIRMADO, ShiftStatus.EN_CAMINO):
            raise InvalidShiftTransitionError(no_se_puede("llegada", self.status))
        now = now or datetime.now(timezone.utc)
        if _naive(now) < _naive(self.expected_from):
            raise InvalidShiftTransitionError(
                "Todavía no empezó el turno: la llegada la puede marcar la persona."
            )
        if self.is_reoffered and _naive(now) >= _naive(self.end_at):
            raise InvalidShiftTransitionError(
                "Este turno ya terminó: no se puede marcar la llegada."
            )
        self.status = ShiftStatus.CHECK_IN
        self.check_in_at = now
        self.arrival_marked_by_company_at = now
        self.arrival_on_time = on_time
        if self.is_reoffered:
            self.prorated_pay_amount = self._prorated_from(now)
        self._clear_en_route()

    def _prorated_from(self, arrival: datetime) -> Decimal:
        """La parte de `pay_amount` que corresponde al horario que resta
        desde `arrival` (decisión 18: se cuenta desde que el reemplazo marca
        la llegada). Al peso entero, nunca más que lo publicado ni negativo."""
        start, end = _naive(self.start_at), _naive(self.end_at)
        total = Decimal((end - start).total_seconds())
        remaining = Decimal((end - max(_naive(arrival), start)).total_seconds())
        amount = (self.pay_amount * remaining / total).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
        return max(Decimal(0), min(amount, self.pay_amount))

    def start_working(self) -> None:
        """CHECK_IN → TRABAJANDO: el trabajador empieza su turno.

        Paso opcional (ADR-0008): mismo criterio que `depart()`, se conserva
        sólo por compatibilidad — la UI actual no ofrece este botón."""
        self._transition(ShiftStatus.CHECK_IN, ShiftStatus.TRABAJANDO, "empezar")

    def check_out(self, latitude: float, longitude: float) -> None:
        """CHECK_IN/TRABAJANDO → CHECK_OUT: el trabajador termina y marca su
        ubicación. ADR-0008: mismo criterio que `check_in()`, directo desde
        CHECK_IN sin exigir `start_working()`; se sigue aceptando TRABAJANDO
        por compatibilidad."""
        if self.status not in (ShiftStatus.CHECK_IN, ShiftStatus.TRABAJANDO):
            raise InvalidShiftTransitionError(
                no_se_puede("salida", self.status)
            )
        now = datetime.now(timezone.utc)
        if _naive(now) < _naive(self.start_at):
            raise InvalidShiftTransitionError(
                "Todavía no podés marcar la salida: el turno empieza "
                f"{format_inicio_art(self.start_at, now)}."
            )
        self._ensure_at_venue(latitude, longitude, "la salida")
        self.status = ShiftStatus.CHECK_OUT
        self.check_out_latitude = latitude
        self.check_out_longitude = longitude
        self.check_out_at = now

    def admin_check_out(self, now: datetime | None = None) -> None:
        """CHECK_IN/TRABAJANDO → CHECK_OUT marcado por la admin en nombre de
        un trabajador suspendido, que ya no puede entrar a marcarlo (decisión
        21, ADR-0024). Como `check_out()`, pero sin ubicación (nadie está en
        el local para informarla) y por lo tanto sin el control de distancia.
        Sí exige que el turno haya empezado: la salida no se marca antes del
        inicio. La hora es la de ahora. Quién decide si corresponde es
        `admin_close_plan`."""
        if self.status not in ADMIN_CHECK_OUT_STATUSES:
            raise InvalidShiftTransitionError(no_se_puede("salida", self.status))
        now = now or datetime.now(timezone.utc)
        if _naive(now) < _naive(self.start_at):
            raise InvalidShiftTransitionError(
                cierre_admin_antes_del_inicio(format_inicio_art(self.start_at, now))
            )
        self.status = ShiftStatus.CHECK_OUT
        self.check_out_latitude = None
        self.check_out_longitude = None
        self.check_out_at = now

    def admin_close_plan(
        self, *, worker_active: bool, company_active: bool, now: datetime
    ) -> AdminClosePlan:
        """Qué haría «Cerrar turno» de la admin (decisión 21, ADR-0024), sin
        cambiar nada. Sólo actúa en nombre de la parte suspendida y sólo en un
        turno empezado (llegada marcada en adelante):

        - trabajador suspendido, llegada marcada: marca la salida;
        - comercio suspendido, salida marcada: cierra el turno;
        - los dos suspendidos, llegada marcada: las dos cosas.

        Si no aplica, `AdminCloseNotAllowedError` con el motivo para la
        admin: ninguna suspendida, el turno no empezó o ya terminó, la salida
        todavía no se puede marcar (antes del inicio) o el paso que falta le
        toca a la parte activa. Lo usa la ficha de la admin para mostrar el
        botón, y el caso de uso para hacerlo: la regla está una sola vez."""
        if self.status not in ADMIN_CHECK_OUT_STATUSES | {ShiftStatus.CHECK_OUT}:
            raise AdminCloseNotAllowedError(cierre_admin_por_estado(self.status))
        if worker_active and company_active:
            raise AdminCloseNotAllowedError(CIERRE_ADMIN_NINGUNA_SUSPENDIDA)
        if self.status == ShiftStatus.CHECK_OUT:
            if company_active:
                raise AdminCloseNotAllowedError(CIERRE_ADMIN_CIERRE_DEL_COMERCIO)
            return AdminClosePlan(
                check_out=False,
                finish=True,
                worker_active=worker_active,
                company_active=company_active,
            )
        if worker_active:
            raise AdminCloseNotAllowedError(CIERRE_ADMIN_SALIDA_DEL_TRABAJADOR)
        if _naive(now) < _naive(self.start_at):
            raise AdminCloseNotAllowedError(
                cierre_admin_antes_del_inicio(format_inicio_art(self.start_at, now))
            )
        return AdminClosePlan(
            check_out=True,
            finish=not company_active,
            worker_active=worker_active,
            company_active=company_active,
        )

    def close_for_suspended_account(
        self,
        admin_user_id: UUID,
        *,
        worker_active: bool,
        company_active: bool,
        expected: tuple[bool, bool] | None = None,
        now: datetime | None = None,
    ) -> AdminClosePlan:
        """Hace lo que dice `admin_close_plan` y deja el registro de quién y
        cuándo (`closed_by_admin_*`). Devuelve el plan, para que el caso de
        uso sepa qué efectos correr y a quién avisar.

        `expected` es lo que la admin vio y confirmó en el diálogo
        (`(check_out, finish)`): si el plan de ahora es otro (el turno o una
        cuenta cambió desde que abrió la ficha), no hace nada y responde
        `CIERRE_ADMIN_CAMBIO`. Nunca se ejecuta más de lo confirmado."""
        now = now or datetime.now(timezone.utc)
        plan = self.admin_close_plan(
            worker_active=worker_active, company_active=company_active, now=now
        )
        if expected is not None and expected != (plan.check_out, plan.finish):
            raise AdminCloseNotAllowedError(CIERRE_ADMIN_CAMBIO)
        if plan.check_out:
            self.admin_check_out(now)
        if plan.finish:
            self.finish()
        self.closed_by_admin_at = now
        self.closed_by_admin_user_id = admin_user_id
        return plan

    def finish(self) -> None:
        """CHECK_OUT → FINALIZADO: cierra el turno trabajado."""
        self._transition(ShiftStatus.CHECK_OUT, ShiftStatus.FINALIZADO, "cerrar")

    def auto_finish(self) -> None:
        """CHECK_OUT → FINALIZADO sin el comercio (decisión 24): el turno
        quedó con la salida marcada y nadie lo cerró. Misma transición que
        `finish`; además deja registrado que lo cerró el sistema."""
        self.finish()
        self.auto_finished_at = datetime.now(timezone.utc)

    def mark_paid(self) -> None:
        """FINALIZADO → PAGADO: el comercio confirma que pagó el turno."""
        self._transition(ShiftStatus.FINALIZADO, ShiftStatus.PAGADO, "pagar")
        self.paid_at = datetime.now(timezone.utc)

    @property
    def unpaid_report_opens_at(self) -> datetime | None:
        """Desde cuándo la persona puede avisar que no cobró. `None` si el turno
        no terminó. No mira si ya avisó o si ya confirmó: eso lo dicen sus
        propias marcas."""
        if self.status not in (ShiftStatus.FINALIZADO, ShiftStatus.PAGADO):
            return None
        return puede_avisar_desde(self.end_at, self.paid_at)

    def worker_confirm_payment(self, now: datetime | None = None) -> bool:
        """La persona asignada confirma que cobró. Definitivo e idempotente:
        devuelve `False` (sin tocar nada) si ya lo había confirmado."""
        self._require_finished_for_payment_report()
        if self.worker_confirmed_paid_at is not None:
            return False
        self.worker_confirmed_paid_at = now or datetime.now(timezone.utc)
        return True

    def worker_report_unpaid(self, now: datetime | None = None) -> bool:
        """La persona asignada avisa que todavía no cobró. Una sola vez por
        turno: devuelve `False` (sin tocar nada) si ya avisó. Con el cobro ya
        confirmado no se puede."""
        self._require_finished_for_payment_report()
        if self.worker_confirmed_paid_at is not None:
            raise PaymentReportNotAllowedError(YA_CONFIRMASTE_EL_COBRO)
        if self.worker_reported_unpaid_at is not None:
            return False
        now = now or datetime.now(timezone.utc)
        desde = self.unpaid_report_opens_at
        assert desde is not None
        if not ya_paso(desde, now):
            raise PaymentReportNotAllowedError(aun_no_se_puede_avisar(desde))
        self.worker_reported_unpaid_at = now
        return True

    def _require_finished_for_payment_report(self) -> None:
        if self.status in (ShiftStatus.FINALIZADO, ShiftStatus.PAGADO):
            return
        if self.status == ShiftStatus.CANCELADO:
            raise PaymentReportNotAllowedError(TURNO_CANCELADO)
        if self.status == ShiftStatus.NO_CUBIERTO:
            raise PaymentReportNotAllowedError(TURNO_NO_CUBIERTO)
        raise PaymentReportNotAllowedError(TODAVIA_NO_TERMINO)

    def _transition(
        self, expected: ShiftStatus, target: ShiftStatus, accion: str
    ) -> None:
        if self.status != expected:
            raise InvalidShiftTransitionError(no_se_puede(accion, self.status))
        self.status = target
