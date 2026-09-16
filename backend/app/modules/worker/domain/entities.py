"""Entidad de dominio PerfilTrabajador.

Modela el perfil de un trabajador de forma pura (sin ORM ni HTTP).
Las métricas e insignias son gestionadas por el sistema, no editables por el usuario.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4

from app.core.dt import naive as _naive
from app.core.tz import hoy_art
from app.modules.worker.domain.value_objects import (
    GamificationLevel,
    WorkerBadge,
    WorkerSkill,
)

# ADR-0014: cuánto dura "Disponible ahora" desde que se prende. Decisión de
# Julieta: alcanza para una sesión de búsqueda real (no un trayecto puntual,
# como el de "va en camino" — EN_ROUTE_WINDOW en shift/domain/entities.py) sin
# acercarse a quedar prendido "todo el día" por olvido.
AVAILABLE_NOW_TTL = timedelta(hours=4)


@dataclass
class WorkerProfile:
    """Raíz de agregado PerfilTrabajador (1:1 con un Usuario de rol worker)."""

    user_id: UUID

    # --- Datos del perfil (editables por el trabajador) ---
    photo_url: str | None = None
    birth_date: date | None = None
    city: str | None = None
    bio: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    skills: list[WorkerSkill] = field(default_factory=list)
    years_experience: int = 0
    languages: list[str] = field(default_factory=list)
    certifications: list[str] = field(default_factory=list)
    cv_url: str | None = None
    # Nombre de archivo original (F1 auditoría 2026-08-10): el `public_id` que
    # asigna Cloudinary a un upload no firmado es un hash, no el nombre real
    # del archivo — sin esto, la UI no tenía forma de mostrar algo legible
    # más que la URL entera. Sólo tiene sentido cuando `cv_url` viene de un
    # archivo subido (no de un link pegado a mano).
    cv_filename: str | None = None
    is_available: bool = True

    # --- "Disponible ahora" (ADR-0014) ---
    # Una sola posición capturada al prenderlo, vigente por AVAILABLE_NOW_TTL
    # o hasta que se apague — nunca un seguimiento continuo (alternativa
    # descartada explícitamente en el ADR). Reemplaza a latitude/longitude
    # para medir distancia mientras está vigente; fuera de esa ventana, el
    # matching y el mapa vuelven solos a la zona del perfil.
    available_now_latitude: float | None = None
    available_now_longitude: float | None = None
    available_now_until: datetime | None = None

    # --- Métricas (gestionadas por el sistema) ---
    rating: float = 0.0
    events_completed: int = 0
    punctuality_rate: float = 0.0
    cancellations: int = 0
    # No-show (Parte C, PRIMER_TURNO_REAL_SPEC / ADR-0007): distinto de
    # `cancellations` (el trabajador avisa antes de que el comercio lo
    # necesite) — acá el trabajador quedó CONFIRMADO/EN_CAMINO y el comercio
    # lo marcó manualmente como no presentado. Señal más grave, se pondera
    # aparte (ver `matching/domain/scoring.py` y `worker/domain/rules.py`).
    no_shows: int = 0
    badges: list[WorkerBadge] = field(default_factory=list)
    level: GamificationLevel = GamificationLevel.BRONCE

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def age(self) -> int | None:
        """Edad calculada a partir de la fecha de nacimiento.

        Usa `hoy_art()` (fecha de negocio en Argentina), no `date.today()`:
        el servidor corre en UTC (Render) y `date.today()` puede adelantar
        el cumpleaños un día entre las 21:00 y las 00:00 ART (fix TZ, ver
        `docs/BUGS.md`)."""
        if self.birth_date is None:
            return None
        today = hoy_art()
        return (
            today.year
            - self.birth_date.year
            - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
        )

    @property
    def is_available_now(self) -> bool:
        """`True` mientras "Disponible ahora" sigue vigente (ADR-0014):
        prendido y todavía no venció su ventana."""
        if self.available_now_until is None:
            return False
        return _naive(datetime.now(timezone.utc)) < _naive(self.available_now_until)

    def go_available_now(self, latitude: float, longitude: float) -> None:
        """Prende "Disponible ahora": captura ESTA posición, vigente por
        `AVAILABLE_NOW_TTL` o hasta apagarlo. No acumula historial — cada
        activación pisa a la anterior, igual que `Shift.report_en_route_location`.

        Sin guard sobre `is_available`: si está en `False`, `search_workers`
        y el matching ya lo excluyen antes de llegar a usar esta posición
        (filtro `is_available` en SQL) — prenderlo sin estar disponible es un
        no-op inofensivo, no un estado inválido que haya que rechazar."""
        self.available_now_latitude = latitude
        self.available_now_longitude = longitude
        self.available_now_until = datetime.now(timezone.utc) + AVAILABLE_NOW_TTL

    def stop_available_now(self) -> None:
        """Apaga "Disponible ahora" ya sea a mano, por vencimiento del TTL
        (scheduler) o al cerrar sesión. Idempotente: no falla si ya estaba
        apagado."""
        self.available_now_latitude = None
        self.available_now_longitude = None
        self.available_now_until = None
