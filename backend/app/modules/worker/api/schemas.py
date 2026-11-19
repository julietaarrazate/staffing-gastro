"""Esquemas HTTP (Pydantic) del módulo worker."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.core.url import HttpsUrl
from app.modules.worker.domain.value_objects import (
    CvFile,
    GamificationLevel,
    WorkerBadge,
    WorkerSkill,
)


class CvFileInput(BaseModel):
    """El CV subido: lo que devuelve Cloudinary al subir un archivo privado
    (ADR-0021, actualización 2026-11-19). No es una URL. Que el archivo sea
    de quien lo pone lo decide el caso de uso (la marca del nombre), no este
    patrón: acá sólo se acota la forma, y entra también la referencia de un
    CV viejo que el script ya pasó a privado."""

    public_id: str = Field(pattern=r"^[A-Za-z0-9_./-]{1,255}$", max_length=255)
    resource_type: Literal["image", "raw"] = "image"
    format: str = Field(default="", pattern=r"^[a-z0-9]{0,10}$")
    type: Literal["private"] = "private"

    def to_domain(self) -> CvFile:
        return CvFile(
            public_id=self.public_id,
            resource_type=self.resource_type,
            format=self.format,
            delivery_type=self.type,
        )


class CvFileResponse(BaseModel):
    """La referencia del CV subido. Sólo la ve el dueño, para mandarla de
    vuelta al guardar el perfil: no abre el archivo por sí sola."""

    model_config = ConfigDict(from_attributes=True)

    public_id: str
    resource_type: str
    format: str
    type: str = Field(validation_alias=AliasChoices("delivery_type", "type"))


class CvLinkResponse(BaseModel):
    """Link para ver el CV. Vence en `expires_at` (5 minutos); `null` sólo
    para un link pegado a mano o un CV viejo todavía público."""

    url: str
    expires_at: datetime | None = None


class WorkerProfileInput(BaseModel):
    """Payload de alta/edición del perfil (sólo campos editables)."""

    photo_url: HttpsUrl | None = None
    birth_date: date | None = None
    city: str | None = Field(default=None, max_length=120)
    bio: str | None = Field(default=None, max_length=1000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    skills: list[WorkerSkill] = Field(default_factory=list)
    years_experience: int = Field(default=0, ge=0, le=80)
    languages: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    # El CV subido (privado). Si el pedido trae `cv_url` y no este campo
    # (una versión vieja de la app), el archivo que ya estaba se conserva.
    cv_file: CvFileInput | None = None
    # Un link pegado a mano (Drive, LinkedIn). Un link de un archivo de
    # Cloudinary ya no entra como link: el CV se sube.
    cv_url: HttpsUrl | None = None
    cv_filename: str | None = Field(default=None, max_length=255)
    is_available: bool = True


class WorkerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    full_name: str | None = None
    photo_url: str | None
    birth_date: date | None
    age: int | None
    city: str | None
    bio: str | None
    latitude: float | None
    longitude: float | None
    skills: list[WorkerSkill]
    years_experience: int
    languages: list[str]
    certifications: list[str]
    # El CV (ADR-0021, actualización 2026-11-19): ninguno de estos campos
    # abre el archivo. `cv_file` y `cv_url` los ve sólo el dueño; los demás
    # ven `cv_kind` («file»: subido, «link»: pegado a mano) y piden
    # `GET /workers/{id}/cv-link`, que da un link que vence.
    cv_file: CvFileResponse | None = None
    cv_url: str | None = None
    cv_filename: str | None = None
    cv_kind: Literal["file", "link"] | None = None
    is_available: bool
    # métricas
    rating: float
    events_completed: int
    punctuality_rate: float
    cancellations: int
    no_shows: int
    badges: list[WorkerBadge]
    level: GamificationLevel
    # Identidad (EPIC-001, ADR-0010): atributo del dominio Identity, NO una
    # insignia de reputación. Lo ve el comercio; nunca se exponen evidencias.
    identidad_verificada: bool = False
    created_at: datetime | None = None


class AvailableNowInput(BaseModel):
    """Payload para prender "Disponible ahora" (ADR-0014): una sola posición
    capturada al tocar el botón, no un seguimiento continuo."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class AvailableNowResponse(BaseModel):
    """Estado de "Disponible ahora" del trabajador autenticado. Deliberadamente
    SIN latitude/longitude: a diferencia de `WorkerProfileResponse` (que
    también sirve para el perfil PÚBLICO, `GET /workers/{id}`), esta respuesta
    sólo la ve el propio trabajador — pero mantenerla sin coordenadas evita
    que un cambio futuro que reutilice este schema en otro lado filtre la
    posición exacta por descuido."""

    active: bool
    until: datetime | None = None


class WorkerEarningsResponse(BaseModel):
    """Resumen de ganancias del trabajador (pedido de Julieta: "un resumen
    de ganancias acumuladas en el perfil"). Cuenta turnos FINALIZADO/PAGADO
    — ya trabajados, cuenten o no todavía como "cobrados" en el sistema."""

    total_earned: Decimal
    this_month_earned: Decimal
    shifts_completed: int
