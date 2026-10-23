"""Puertos de persistencia del módulo subscription.

`SubscriptionRepository` también se consume desde `shift` (cruce de módulo)
para el gating al publicar un turno — sólo este puerto de dominio se importa
desde ahí, nunca la capa de aplicación de `subscription` (ver
`ShiftService._consume_publication_slot`).
"""

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from app.modules.subscription.domain.entities import Subscription, SubscriptionPayment
from app.modules.subscription.domain.value_objects import SubscriptionStatus


class SubscriptionRepository(ABC):
    """Puerto de persistencia para Subscription (1:1 con Company)."""

    @abstractmethod
    async def add(self, subscription: Subscription) -> Subscription:
        """Persiste una nueva suscripción y la devuelve."""

    @abstractmethod
    async def update(self, subscription: Subscription) -> Subscription:
        """Actualiza una suscripción existente y la devuelve."""

    @abstractmethod
    async def get_by_company_id(self, company_id: UUID) -> Subscription | None:
        """Busca la suscripción de un comercio."""

    @abstractmethod
    async def get_or_create(
        self,
        company_id: UUID,
        *,
        initial_status: SubscriptionStatus = SubscriptionStatus.ACTIVA,
    ) -> Subscription:
        """Devuelve la suscripción del comercio; si todavía no tiene una (primer
        acceso), la crea en el plan por defecto (`inicial`, ADR-0020) con
        `initial_status` (`pendiente` cuando el cobro real se exige, ADR-0022)."""

    @abstractmethod
    async def list_paid(self) -> list[Subscription]:
        """Suscripciones `activa` con `paid_until` (las que el chequeo de
        vencimiento tiene que mirar)."""

    @abstractmethod
    async def count_by_plan_and_status(self) -> list[tuple[str, str, int]]:
        """Conteo agregado `(plan_code, status, cantidad)` de las suscripciones
        que ya tienen fila (panel de admin, MRR)."""

    @abstractmethod
    async def count_at_plan_limit(self, limits: dict[str, int], *, now: datetime) -> int:
        """Cuenta comercios cuyo `turnos_usados_mes` ya alcanzó el tope de su
        plan, sólo con la ventana de uso vigente (auditoría 2026-08-15, F3)."""


class SubscriptionPaymentRepository(ABC):
    """Puerto de persistencia de los intentos de pago mensual."""

    @abstractmethod
    async def add(self, payment: SubscriptionPayment) -> SubscriptionPayment:
        """Persiste un intento nuevo."""

    @abstractmethod
    async def update(self, payment: SubscriptionPayment) -> SubscriptionPayment:
        """Guarda los cambios de un intento."""

    @abstractmethod
    async def get_by_id(self, payment_id: UUID) -> SubscriptionPayment | None:
        """Busca un intento por su id (el `external_reference`)."""

    @abstractmethod
    async def get_by_mp_payment_id(self, mp_payment_id: str) -> SubscriptionPayment | None:
        """Busca el intento al que ya se asoció un pago de Mercado Pago."""

    @abstractmethod
    async def try_approve(
        self, payment_id: UUID, *, mp_payment_id: str, approved_at: datetime
    ) -> bool:
        """Marca el intento `aprobado` sólo si todavía no lo estaba, en una
        sola sentencia. Devuelve False si otro webhook ganó la carrera: así un
        mismo pago nunca acredita dos meses."""

    @abstractmethod
    async def list_approved_by_company(self, company_id: UUID) -> list[SubscriptionPayment]:
        """Pagos aprobados o reembolsados del comercio, del más viejo al más
        nuevo (para el arrepentimiento)."""
