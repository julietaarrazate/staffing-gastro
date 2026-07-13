"""Puerto del repositorio de suscripciones.

Consumido también desde `shift` (cruce de módulo) para el gating de capacidad
al publicar un turno — sólo este puerto de dominio se importa desde ahí,
nunca la capa de aplicación de `subscription` (ver
`ShiftService._consume_publication_slot`, mismo patrón cross-módulo que
`CompanyProfileRepository`/`WorkerProfileRepository` en ARCHITECTURE.md).
"""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.subscription.domain.entities import Subscription


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
    async def get_or_create(self, company_id: UUID) -> Subscription:
        """Devuelve la suscripción del comercio; si todavía no tiene una (primer
        acceso), la crea en el plan `gratis` con un período nuevo y la
        persiste. Así "cada comercio nuevo arranca en gratis" (ADR-0005) sin
        depender de un hook en el alta del perfil de comercio."""
