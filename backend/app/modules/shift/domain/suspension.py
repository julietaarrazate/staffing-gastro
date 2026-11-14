"""Qué les pasa a los turnos cuando se suspende una cuenta (ADR-0024).

Reglas puras: qué turnos se ocultan, cuáles se cancelan y cuáles se reabren.
Quién avisa a quién y en qué orden se guarda lo decide el caso de uso
(`ShiftService.apply_account_suspension`).

- **Comercio suspendido:** sus turnos abiertos (publicados o buscando
  personal, con la hora por delante) dejan de verse. No se tocan: se ocultan
  mientras la cuenta no esté activa y vuelven a verse si se reactiva. Los que
  tienen a alguien asignado o confirmado y no empezaron se cancelan.
- **Trabajador suspendido:** sus turnos asignados o confirmados que no
  empezaron se reabren.
- Lo que ya empezó (llegada marcada en adelante) no se toca.

El puerto `AccountSuspensionEffects` es por donde otro módulo (la
administración) pide la vista previa y los efectos, sin conocer el caso de
uso de turnos (PRINCIPLES §6)."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.value_objects import TAKEN_NOT_STARTED_STATUSES


@dataclass(frozen=True)
class SuspensionImpact:
    """Cuántos turnos toca suspender una cuenta.

    - `hidden`: turnos abiertos del comercio que dejan de verse (no cambian).
    - `cancelled`: turnos del comercio con alguien asignado o confirmado que
      se cancelan con aviso a esa persona.
    - `reopened`: turnos del trabajador que vuelven a buscar personal, con
      aviso al comercio."""

    hidden: int = 0
    cancelled: int = 0
    reopened: int = 0

    def __add__(self, other: "SuspensionImpact") -> "SuspensionImpact":
        return SuspensionImpact(
            hidden=self.hidden + other.hidden,
            cancelled=self.cancelled + other.cancelled,
            reopened=self.reopened + other.reopened,
        )


def shifts_hidden_by_company_suspension(shifts: list[Shift], now: datetime) -> list[Shift]:
    """Los turnos del comercio que hoy se ofrecen para postularse: los que la
    suspensión saca del Inicio, Buscar, el Mapa y la página pública."""
    return [s for s in shifts if s.is_open_for_applications(now)]


def shifts_taken_not_started(shifts: list[Shift]) -> list[Shift]:
    """Los turnos con alguien asignado o confirmado que todavía no empezaron:
    los que se cancelan (comercio suspendido) o se reabren (trabajador
    suspendido)."""
    return [s for s in shifts if s.status in TAKEN_NOT_STARTED_STATUSES]


class AccountSuspensionEffects(ABC):
    """Puerto: los efectos de suspender una cuenta sobre sus turnos."""

    @abstractmethod
    async def preview_account_suspension(self, user_id: UUID) -> SuspensionImpact:
        """Cuántos turnos tocaría suspender la cuenta `user_id`, sin cambiar nada."""

    @abstractmethod
    async def apply_account_suspension(self, user_id: UUID) -> SuspensionImpact:
        """Cancela o reabre lo que corresponde y avisa a cada persona afectada.
        Se llama ANTES de marcar la cuenta como suspendida (ver
        `AdminService.suspend_user`)."""
