"""Esquemas HTTP (Pydantic) del módulo shift."""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.modules.shift.domain.pay_benchmark import PayBand
from app.modules.shift.domain.reconfirmacion import avisa_con_tiempo
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.domain.value_objects import WorkerSkill


class FeedScope(str, Enum):
    """Alcance de `GET /shifts/feed`.

    - `nearby` (por defecto): sólo lo que queda cerca. Es el feed del Inicio
      y del Mapa.
    - `all`: todo el mercado, ordenado por distancia cuando hay desde dónde
      medir. Es Buscar, la pantalla para mirar otras zonas.
    """

    NEARBY = "nearby"
    ALL = "all"


class ShiftInput(BaseModel):
    """Payload de alta/edición de un turno."""

    position: WorkerSkill
    quantity: int = Field(
        default=1,
        ge=1,
        le=1,
        description=(
            "Por ahora, un turno = una persona. Para varios puestos creá "
            "varios turnos (falta multi-asignación, ver R1.4/TECH_DEBT P1)."
        ),
    )
    start_at: datetime
    end_at: datetime
    pay_amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="ARS", min_length=3, max_length=3)
    tips: bool = False
    meal: bool = False
    dress_code: str | None = Field(default=None, max_length=255)
    urgent: bool = False
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    title: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=1000)

    @field_validator("quantity", mode="before")
    @classmethod
    def _capar_quantity_a_uno(cls, value: object) -> object:
        """Mensaje claro cuando se pide más de un puesto (decisión R1.4).

        `le=1` ya lo rechaza, pero acá damos un detalle en español legible en
        vez del genérico "Input should be less than or equal to 1".
        """
        if isinstance(value, int) and value != 1:
            raise ValueError(
                "Por ahora, un turno = una persona (quantity debe ser 1). "
                "Para cubrir varios puestos, creá varios turnos."
            )
        return value


class ShiftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    position: WorkerSkill
    quantity: int
    start_at: datetime
    end_at: datetime
    pay_amount: Decimal
    currency: str
    tips: bool
    meal: bool = False
    dress_code: str | None
    urgent: bool
    address: str | None
    city: str | None
    latitude: float | None
    longitude: float | None
    title: str | None
    description: str | None
    status: ShiftStatus
    worker_profile_id: UUID | None
    # "Va en camino": última posición del trabajador viajando al turno. `None`
    # salvo mientras efectivamente va en camino — se borra al llegar.
    en_route_latitude: float | None = None
    en_route_longitude: float | None = None
    en_route_at: datetime | None = None
    check_in_latitude: float | None
    check_in_longitude: float | None
    check_in_at: datetime | None
    check_out_latitude: float | None
    check_out_longitude: float | None
    check_out_at: datetime | None
    paid_at: datetime | None
    no_show_at: datetime | None = None
    last_no_show_worker_profile_id: UUID | None = None
    event_id: UUID | None = None
    event_name: str | None = None
    published_at: datetime | None = None
    first_assigned_at: datetime | None = None
    created_at: datetime | None = None
    # Turno reofrecido (U080): se reabrió con el horario ya empezado y se
    # ofrece como urgente hasta `offered_until`. Mientras nadie marcó la llegada, lo
    # que se muestra es el valor por hora (`hourly_pay_amount`, calculado en
    # el dominio; `None` en cualquier otro turno), porque el total depende de
    # cuándo llegue quien lo tome. Son datos del turno: los ve cualquiera.
    reoffered_at: datetime | None = None
    hourly_pay_amount: Decimal | None = None
    # Lo que se paga por un turno reofrecido, fijado cuando el reemplazo marca
    # la llegada. Es de las partes (el comercio dueño y la persona asignada):
    # `without_worker_data` lo borra, porque de él se deduce a qué hora llegó.
    prorated_pay_amount: Decimal | None = None
    # Cuándo confirmó quien tiene el turno ahora. De las partes: el panel lo
    # usa para saber desde cuándo se puede marcar «No se presentó» a quien
    # tomó un turno ya empezado.
    confirmed_at: datetime | None = None
    # Puntualidad real (ADR-0008 act. 2026-11-26). De las partes: si la
    # llegada la marcó el comercio y qué dijo (a horario o tarde).
    arrival_marked_by_company_at: datetime | None = None
    arrival_on_time: bool | None = None
    # Reconfirmación antes del turno (ADR-0031, P3). De las partes: a la
    # persona, si tiene una pregunta sin contestar; al comercio, cuándo
    # reconfirmó o cuándo se le avisó que no contestó.
    # ¿El comercio lo puede corregir? Mientras nadie esté asignado
    # (`Shift.is_editable`). La pantalla lo usa para ofrecer «Editar».
    is_editable: bool = False
    reconfirmation_pending: bool | None = None
    reconfirmed_at: datetime | None = None
    no_reconfirm_alert_sent_at: datetime | None = None
    # ¿Cancelar ahora es avisar con tiempo, y entonces no le suma una
    # cancelación a la persona? Para que el cartel de «Cancelar mi
    # asignación» diga la verdad. `None` si el turno no está confirmado. Las dos marcas de abajo sólo sirven para
    # calcularlo: no salen en la respuesta.
    cancel_with_notice: bool | None = None
    reconfirm_24h_sent_at: datetime | None = Field(default=None, exclude=True)
    reconfirm_3h_sent_at: datetime | None = Field(default=None, exclude=True)
    company_name: str | None = None
    company_logo_url: str | None = None
    company_cover_url: str | None = None
    # Pago de referencia (ADR-0012): dónde cae el pago por hora de este turno
    # respecto de lo que se paga para el mismo puesto en la misma ciudad.
    # `None` cuando no hay con qué comparar (muestra insuficiente, sin ciudad)
    # — que es lo normal al arrancar. La UI no muestra nada en ese caso: una
    # referencia inventada engañaría al trabajador Y al comercio.
    pay_band: PayBand | None = None
    # Nombre del trabajador asignado. Se completa SÓLO en `/shifts/me` (los
    # turnos del propio comercio): es un dato de una persona, y el feed y
    # `/shifts/mine` los leen otros trabajadores, que no tienen por qué ver
    # quién tomó cada turno. Hoy lo usa "va en camino" para decir "Juan va en
    # camino" en vez del genérico.
    worker_name: str | None = None
    # Postulaciones PENDIENTES del turno. Como `worker_name`: se completa SÓLO
    # en `/shifts/me` (el comercio dueño) y es `None` en el feed, el turno
    # público y `/shifts/mine`; `without_worker_data` también lo borra.
    pending_applicants_count: int | None = None
    # ADR-0011: claim `negocio_verificado` del dueño del comercio
    # (`CompanyProfile.user_id`) — no hay flujo de envío/revisión de
    # evidencias de negocio todavía, así que hoy siempre da `False`; el
    # campo queda listo para cuando exista (sin datos simulados).
    company_verified: bool = False

    @model_validator(mode="after")
    def _cancelar_con_aviso(self) -> "ShiftResponse":
        if (
            # Sólo para las partes: a quien no lo es, `without_worker_data`
            # le borra la persona asignada. Sin esta condición FastAPI, al
            # validar de nuevo la respuesta, lo volvía a calcular para ellos.
            self.worker_profile_id is not None
            and self.cancel_with_notice is None
            and self.status == ShiftStatus.CONFIRMADO
        ):
            self.cancel_with_notice = avisa_con_tiempo(
                self.start_at,
                self.reconfirm_24h_sent_at,
                self.reconfirm_3h_sent_at,
                datetime.now(timezone.utc),
            )
        return self


# Datos de una PERSONA (el trabajador del turno), no del turno: quién lo tomó,
# dónde está viajando, dónde marcó llegada y salida, quién faltó.
WORKER_DATA_FIELDS = (
    "worker_profile_id",
    "worker_name",
    "pending_applicants_count",
    "en_route_latitude",
    "en_route_longitude",
    "en_route_at",
    "check_in_latitude",
    "check_in_longitude",
    "check_in_at",
    "check_out_latitude",
    "check_out_longitude",
    "check_out_at",
    # Cuándo el comercio le pagó a quien lo trabajó: a un postulante que no
    # quedó, o a quien sólo lo guardó, no le corresponde (pasada de
    # privacidad 2026-11-19, PRI-05).
    "paid_at",
    "no_show_at",
    "last_no_show_worker_profile_id",
    "prorated_pay_amount",
    "confirmed_at",
    "arrival_marked_by_company_at",
    "arrival_on_time",
    "reconfirmation_pending",
    "reconfirmed_at",
    "no_reconfirm_alert_sent_at",
    "cancel_with_notice",
)


def without_worker_data(response: ShiftResponse) -> ShiftResponse:
    """La vista de un turno para quien no es parte de él: todo lo del turno,
    nada del trabajador.

    Vive acá (y no en `routes.py`) porque no es sólo del detalle del turno:
    cualquier endpoint que embeba un `ShiftResponse` para alguien que no es
    parte —turnos guardados, "mis postulaciones"— tiene que pasar por acá."""
    return response.model_copy(update={field: None for field in WORKER_DATA_FIELDS})


# La última ausencia del turno: quién faltó y cuándo. Es un dato de QUIEN
# FALTÓ, no de quien tiene el turno ahora. Un turno reofrecido (U080) se
# reasigna con esos campos puestos, y quien lo tomaba después los heredaba
# como "parte" del turno; con el id llegaba al perfil público de quien faltó
# (pasada de privacidad 2026-11-19, PRI-01). Los ve el comercio dueño, admin
# y la propia persona que faltó.
NO_SHOW_FIELDS = ("no_show_at", "last_no_show_worker_profile_id")


def for_worker(response: ShiftResponse, worker_profile_id: UUID) -> ShiftResponse:
    """La vista de un turno para un TRABAJADOR: si no lo tiene asignado, la
    de quien no es parte (`without_worker_data`); si lo tiene, el turno
    entero salvo la ausencia de otra persona.

    Toda respuesta que embeba un `ShiftResponse` para un trabajador pasa por
    acá: el detalle, `/shifts/mine`, «Mis postulaciones», «Guardados» y las
    respuestas de sus propias acciones (confirmar, llegar, salir…)."""
    if response.worker_profile_id != worker_profile_id:
        return without_worker_data(response)
    if response.last_no_show_worker_profile_id == worker_profile_id:
        return response
    return response.model_copy(update={field: None for field in NO_SHOW_FIELDS})


class EventRoleInput(BaseModel):
    """Un rol dentro de una publicación masiva: "necesito 3 mozos a $50000"."""

    position: WorkerSkill
    count: int = Field(ge=1, le=50)
    pay_amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class EventInput(BaseModel):
    """Payload de "Publicar para un evento": un formulario, varios roles —
    cada uno se publica como turno individual (ver `ShiftService.create_event`,
    ADR-0003 sigue vigente: quantity=1 por turno)."""

    name: str = Field(min_length=1, max_length=200)
    start_at: datetime
    end_at: datetime
    roles: list[EventRoleInput] = Field(min_length=1, max_length=20)
    currency: str = Field(default="ARS", min_length=3, max_length=3)
    tips: bool = False
    meal: bool = False
    dress_code: str | None = Field(default=None, max_length=255)
    urgent: bool = False
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    description: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _exigir_zona(self) -> "EventInput":
        """Un evento no se publica sin zona: sin ciudad el panel y las tarjetas
        dicen «Ubicación a confirmar», y sin coordenadas no se avisa a nadie
        cerca (el aviso mide la distancia con ellas; la ciudad sola no entra).
        Se piden las dos. Vive acá y no sólo en el formulario para que no
        dependa del cliente (app, asistente, scripts)."""
        tiene_ciudad = bool(self.city and self.city.strip())
        tiene_coordenadas = self.latitude is not None and self.longitude is not None
        if not (tiene_ciudad and tiene_coordenadas):
            # PydanticCustomError y no ValueError: este último antepone
            # «Value error, » al mensaje.
            raise PydanticCustomError(
                "zona_requerida",
                "Elegí la zona del evento (provincia y barrio, o tu local con "
                "ubicación): sin eso no podemos avisar a la gente que está cerca.",
            )
        return self


class EventCancelResponse(BaseModel):
    """Resultado de cancelar un evento entero (U084): los puestos que se
    cancelaron ahora. Los que ya habían terminado o estaban cancelados no
    vienen."""

    event_id: UUID
    cancelled: list[ShiftResponse]


class EventResponse(BaseModel):
    """Resultado de publicar un evento: `requested` vs. la cantidad real de
    `shifts` — si son distintos, el plan del comercio se quedó sin cupo a
    mitad de camino (publicación parcial)."""

    event_id: UUID
    requested: int
    shifts: list[ShiftResponse]


class ShiftPublicResponse(BaseModel):
    """Vista pública de un turno (sin autenticación), para compartir por
    WhatsApp/redes. Sólo campos seguros: nada de contacto del comercio,
    postulantes, ni ids internos más allá del propio turno."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    position: WorkerSkill
    start_at: datetime
    end_at: datetime
    city: str | None
    pay_amount: Decimal
    currency: str
    # Turno reofrecido (U080): ya empezó y se ofrece hasta `offered_until`; se
    # muestra el valor por hora. Ver `ShiftResponse`.
    reoffered_at: datetime | None = None
    hourly_pay_amount: Decimal | None = None
    company_name: str | None = None
    # Las condiciones del turno, que es con lo que alguien decide si le
    # conviene registrarse (Julieta, 2026-09-22). Son del turno, no de una
    # persona. Siguen FUERA: la dirección exacta, la descripción libre (la
    # escribe el comercio y puede traer un teléfono) y el logo del comercio.
    tips: bool = False
    meal: bool = False
    dress_code: str | None = None
    urgent: bool = False
    # La foto del local SÍ va (Julieta, 2026-09-23): es del lugar, no de una
    # persona, y ver dónde se trabaja es lo que convence a quien llega por un
    # link de registrarse. El logo sigue afuera, como se decidió el 2026-09-22.
    company_cover_url: str | None = None


class CompanyCheckInRequest(BaseModel):
    """«Ya llegó»: el comercio marca la llegada de quien no la marcó."""

    on_time: bool


class AssignWorkerRequest(BaseModel):
    """Payload para asignar el turno a un candidato."""

    worker_profile_id: UUID


class GeoCheckRequest(BaseModel):
    """Payload de check-in/check-out con la ubicación del trabajador."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ParseShiftTextRequest(BaseModel):
    """Texto libre a interpretar (P2, auditoría de producto 2026-08-10)."""

    text: str = Field(min_length=3, max_length=500)


class ParsedShiftDraftResponse(BaseModel):
    """Campos parciales para PRECARGAR el wizard — el comercio revisa y
    confirma cada paso a mano, esto nunca publica un turno directamente."""

    position: WorkerSkill | None
    start_at: datetime | None
    end_at: datetime | None
    pay_amount: Decimal | None
    urgent: bool
    meal: bool
    tips: bool
    dress_code: str | None
    # Qué falta definir, en palabras ("a qué hora termina"), para que la UI
    # pueda PREGUNTARLO en vez de dejar al comercio adivinar por qué el
    # wizard frenó donde frenó. Lista vacía = el texto alcanzó para todo.
    missing: list[str] = []
