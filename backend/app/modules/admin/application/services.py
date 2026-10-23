"""Casos de uso del módulo de administración.

Reutiliza los puertos `UserRepository` (identity) y `ShiftRepository`
(shift): no introduce persistencia propia, sólo orquesta operaciones de
moderación de usuarios y el cálculo de métricas agregadas.
"""

import secrets
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from app.core.dt import naive as _naive
from app.core.security import create_access_token, hash_password
from app.core.tz import now_art, to_art
from app.modules.admin.application.dtos import (
    AdminCompanySummary,
    AdminShiftRow,
    AdminTicketRow,
    AdminUserDetail,
    AdminUserRow,
    AdminWorkerSummary,
    LiveShiftRow,
    LiveShiftsBoard,
    PeriodMetrics,
    PeriodSummary,
    PlatformStats,
    SubscriptionStats,
    TestAccount,
    TodayCounts,
)
from app.modules.admin.application.exceptions import (
    CannotImpersonateAdminError,
    CannotModifySelfError,
    TargetUserNotFoundError,
)
from app.modules.admin.application.periods import day_bounds, period_bounds
from app.modules.application.domain.repositories import ShiftApplicationRepository
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.identity.application.services import GUEST_ACCOUNT_EMAILS
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.repositories import RefreshSessionRepository, UserRepository
from app.modules.identity.domain.value_objects import UserRole, UserStatus
from app.modules.shift.domain.repositories import ShiftPeriodStats, ShiftRepository
from app.modules.subscription.domain.billing_gateway import BillingGateway
from app.modules.subscription.domain.plans import DEFAULT_PLAN_CODE, get_plan, list_plans
from app.modules.subscription.domain.repositories import SubscriptionRepository
from app.modules.subscription.domain.value_objects import SubscriptionStatus
from app.modules.support.domain.repositories import SupportTicketRepository
from app.modules.worker.domain.repositories import WorkerProfileRepository


# Cuentas de prueba para que la administradora entre como cada rol vía
# "Ver como" sin usar datos de usuarios reales (mismo patrón que
# `GUEST_ACCOUNTS` en identity, pero acá el acceso es por impersonación
# admin en vez de un PIN público).
#
# Exportada sin `_` (antes privada) para que `scripts/seed_demo_data.py` pueda
# resolver email+nombre por rol sin duplicar estos datos a mano.
TEST_ACCOUNTS: dict[UserRole, tuple[str, str]] = {
    UserRole.WORKER: ("prueba.trabajador@oido.beta", "Prueba · Trabajador"),
    UserRole.EMPLOYER: ("prueba.comercio@oido.beta", "Prueba · Comercio"),
}

# Emails de las cuentas de prueba, para excluirlas de las métricas del panel
# (mismo motivo que `GUEST_ACCOUNT_EMAILS` en identity — auditoría
# 2026-08-15, F2: se creaban solas al abrir el panel y se contaban como
# usuarios reales).
TEST_ACCOUNT_EMAILS: frozenset[str] = frozenset(
    email for email, _ in TEST_ACCOUNTS.values()
)


def _local_password() -> str:
    """Contraseña local irrecuperable: nadie puede iniciar sesión en la
    cuenta de prueba con email+contraseña, sólo vía "Ver como" (admin)."""
    return hash_password(secrets.token_urlsafe(32))


def _rate_pct(numerator: int, denominator: int) -> float | None:
    """`%` de dos conteos, o `None` sin muestra — nunca un `%` sobre cero
    casos (mismo criterio que `pct_filled_under_10_min`, ya existente)."""
    return (numerator / denominator) * 100 if denominator else None


class AdminService:
    """Servicio de aplicación con los casos de uso del panel de administración."""

    def __init__(
        self,
        users: UserRepository,
        shifts: ShiftRepository,
        workers: WorkerProfileRepository,
        companies: CompanyProfileRepository,
        applications: ShiftApplicationRepository,
        subscriptions: SubscriptionRepository,
        billing: BillingGateway,
        sessions: RefreshSessionRepository,
        tickets: SupportTicketRepository,
    ) -> None:
        self._users = users
        self._shifts = shifts
        self._workers = workers
        self._companies = companies
        self._applications = applications
        self._subscriptions = subscriptions
        self._billing = billing
        self._sessions = sessions
        self._tickets = tickets

    # Turnos y tickets que muestra la ficha de una persona: los más recientes.
    DETAIL_RECENT_LIMIT = 5

    async def list_users(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        search: str | None = None,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        verified: bool | None = None,
    ) -> list[AdminUserRow]:
        """Lista usuarios paginados (más recientes primero), con los filtros
        del buscador de "Personas" y la foto de perfil (trabajador) o logo
        (comercio) resuelta en 2 consultas batch en vez de una por fila."""
        users = await self._users.list_all(
            limit=limit,
            offset=offset,
            search=search.strip() if search else None,
            role=role,
            status=status,
            verified=verified,
        )
        return await self._rows(users)

    async def _rows(self, users: list[User]) -> list[AdminUserRow]:
        worker_ids = [u.id for u in users if u.role == UserRole.WORKER]
        employer_ids = [u.id for u in users if u.role == UserRole.EMPLOYER]
        worker_photos = await self._workers.photo_urls_by_user_ids(worker_ids)
        company_photos = await self._companies.photo_urls_by_user_ids(employer_ids)
        return [
            AdminUserRow(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                status=u.status,
                is_verified=u.is_verified,
                created_at=u.created_at,
                photo_url=worker_photos.get(u.id) or company_photos.get(u.id),
            )
            for u in users
        ]

    async def get_user_detail(self, user_id: UUID) -> AdminUserDetail:
        """Ficha de una persona: cuenta, perfil según el rol (reputación del
        trabajador o datos del comercio), turnos y tickets recientes."""
        user = await self._get(user_id)
        [row] = await self._rows([user])
        limit = self.DETAIL_RECENT_LIMIT

        worker_summary = None
        company_summary = None
        shifts = []
        if user.role == UserRole.WORKER:
            profile = await self._workers.get_by_user_id(user.id)
            if profile is not None:
                worker_summary = AdminWorkerSummary(
                    city=profile.city,
                    skills=[s.value for s in profile.skills],
                    years_experience=profile.years_experience,
                    is_available=profile.is_available,
                    rating=profile.rating,
                    events_completed=profile.events_completed,
                    punctuality_rate=profile.punctuality_rate,
                    cancellations=profile.cancellations,
                    no_shows=profile.no_shows,
                    level=profile.level.value,
                )
                shifts = await self._shifts.list_by_worker(profile.id, limit=limit)
        elif user.role == UserRole.EMPLOYER:
            company = await self._companies.get_by_user_id(user.id)
            if company is not None:
                company_summary = AdminCompanySummary(
                    name=company.name,
                    category=company.category.value if company.category else None,
                    address=company.address,
                    city=company.city,
                    rating=company.rating,
                    events_published=company.events_published,
                    on_time_payment_rate=company.on_time_payment_rate,
                    late_cancellations=company.late_cancellations,
                )
                shifts = await self._shifts.list_by_company(company.id, limit=limit)

        tickets = await self._tickets.list_by_user(user.id, limit=limit)
        return AdminUserDetail(
            user=row,
            worker=worker_summary,
            company=company_summary,
            recent_shifts=[
                AdminShiftRow(
                    id=s.id,
                    title=s.title,
                    position=s.position.value,
                    start_at=s.start_at,
                    status=s.status.value,
                    pay_amount=s.pay_amount,
                )
                for s in shifts
            ],
            tickets=[
                AdminTicketRow(
                    id=t.id,
                    subject=t.subject,
                    status=t.status.value,
                    created_at=t.created_at,
                )
                for t in tickets
            ],
        )

    async def get_stats(self) -> PlatformStats:
        """Calcula métricas agregadas de la plataforma, incluida la promesa
        central del negocio ("cubrir un puesto en <10 minutos", ver
        `Shift.published_at`/`first_assigned_at`).

        Los conteos de usuarios se calculan en SQL (`UserRepository.count_stats`,
        PRODUCTION_HARDENING.md P5) — antes traía toda la tabla `users` y
        contaba en Python en cada carga del panel de admin."""
        counts = await self._users.count_stats(
            exclude_emails=GUEST_ACCOUNT_EMAILS | TEST_ACCOUNT_EMAILS
        )
        filled_shifts = await self._shifts.list_recently_filled()
        minutes = [
            (_naive(s.first_assigned_at) - _naive(s.published_at)).total_seconds() / 60
            for s in filled_shifts
            if s.published_at is not None and s.first_assigned_at is not None
        ]

        publication_stats = await self._shifts.count_publication_stats()
        application_stats = await self._applications.count_application_stats()
        worker_stats = await self._workers.count_engagement_stats()
        company_stats = await self._companies.count_engagement_stats()

        no_show_sample_size = (
            worker_stats.completed_total
            + worker_stats.cancellations_total
            + worker_stats.no_shows_total
        )

        return PlatformStats(
            total_users=counts.total,
            workers=counts.workers,
            employers=counts.employers,
            admins=counts.admins,
            active=counts.active,
            suspended=counts.suspended,
            verified=counts.verified,
            coverage_sample_size=len(minutes),
            avg_time_to_fill_minutes=(sum(minutes) / len(minutes)) if minutes else None,
            pct_filled_under_10_min=(
                (sum(1 for m in minutes if m <= 10) / len(minutes)) * 100 if minutes else None
            ),
            shift_assignment_rate_sample_size=publication_stats.published,
            shift_assignment_rate_pct=_rate_pct(
                publication_stats.assigned, publication_stats.published
            ),
            shift_completion_rate_sample_size=publication_stats.published,
            shift_completion_rate_pct=_rate_pct(
                publication_stats.completed, publication_stats.published
            ),
            application_acceptance_sample_size=application_stats.total,
            application_to_acceptance_rate_pct=_rate_pct(
                application_stats.accepted, application_stats.total
            ),
            no_show_sample_size=no_show_sample_size,
            no_show_rate_pct=_rate_pct(worker_stats.no_shows_total, no_show_sample_size),
            worker_completion_repeat_sample_size=worker_stats.workers_with_1plus_events,
            worker_completion_repeat_rate_pct=_rate_pct(
                worker_stats.workers_with_2plus_events, worker_stats.workers_with_1plus_events
            ),
            employer_repeat_sample_size=company_stats.companies_with_1plus_shifts,
            employer_repeat_rate_pct=_rate_pct(
                company_stats.companies_with_2plus_shifts,
                company_stats.companies_with_1plus_shifts,
            ),
        )

    # Tope de "Turnos en vivo": más que esto no se mira en una pantalla, y
    # sin tope un día raro traería la tabla entera cada 30 segundos.
    LIVE_SHIFTS_LIMIT = 200

    async def list_live_shifts(
        self,
        *,
        urgent_only: bool = False,
        escalated_only: bool = False,
        now: datetime | None = None,
    ) -> LiveShiftsBoard:
        """"Turnos en vivo": publicados y sin nadie confirmado, con los
        minutos que llevan sin cubrir, el comercio y cuántas postulaciones
        tienen. Tres consultas fijas (turnos, comercios, postulaciones),
        sin importar cuántos turnos haya."""
        now = now or now_art()
        shifts = await self._shifts.list_live(limit=self.LIVE_SHIFTS_LIMIT)
        companies = await self._companies.list_by_ids(list({s.company_id for s in shifts}))
        applications = await self._applications.count_active_by_shift_ids([s.id for s in shifts])

        rows = [
            LiveShiftRow(
                id=s.id,
                title=s.title,
                position=s.position.value,
                status=s.status.value,
                start_at=s.start_at,
                end_at=s.end_at,
                city=s.city,
                company_name=companies[s.company_id].name if s.company_id in companies else None,
                urgent=s.urgent,
                escalated=s.escalated_at is not None,
                escalated_at=s.escalated_at,
                published_at=s.published_at,
                minutes_open=max(
                    int((now - to_art(s.published_at)).total_seconds() // 60), 0
                ),
                applications=applications.get(s.id, 0),
            )
            for s in shifts
            if s.published_at is not None
        ]
        filtered = [
            r
            for r in rows
            if (not urgent_only or r.urgent) and (not escalated_only or r.escalated)
        ]
        return LiveShiftsBoard(
            generated_at=now,
            total=len(rows),
            urgent=sum(1 for r in rows if r.urgent),
            escalated=sum(1 for r in rows if r.escalated),
            shifts=filtered,
        )

    async def get_today_counts(self, *, now: datetime | None = None) -> TodayCounts:
        """Urgentes sin cubrir y ausencias del día argentino de hoy, para
        la portada "Hoy"."""
        day_start, day_end = day_bounds(now or now_art())
        counts = await self._shifts.count_today(day_start=day_start, day_end=day_end)
        return TodayCounts(
            urgent_uncovered=counts.urgent_uncovered,
            no_shows_today=counts.no_shows_today,
        )

    async def get_period_metrics(
        self, days: int, *, now: datetime | None = None
    ) -> PeriodMetrics:
        """"Métricas" de los últimos `days` días argentinos contra los
        `days` anteriores. Dos consultas fijas (turnos y postulaciones),
        cada una con los dos períodos adentro."""
        bounds = period_bounds(days, now or now_art())
        window = {
            "previous_start": bounds.previous_start,
            "current_start": bounds.current_start,
            "end": bounds.end,
        }
        current, previous = await self._shifts.count_period_stats(**window)
        apps_current, apps_previous = await self._applications.count_created_by_period(**window)

        def _summary(
            start: datetime, end: datetime, s: ShiftPeriodStats, apps: int
        ) -> PeriodSummary:
            return PeriodSummary(
                start=start,
                end=end,
                shifts_published=s.published,
                shifts_covered=s.covered,
                covered_pct=_rate_pct(s.covered, s.published),
                covered_under_10_min_pct=_rate_pct(s.covered_under_10_min, s.covered),
                avg_minutes_to_cover=s.avg_minutes_to_cover,
                applications=apps,
            )

        return PeriodMetrics(
            days=days,
            current=_summary(bounds.current_start, bounds.end, current, apps_current),
            previous=_summary(bounds.previous_start, bounds.current_start, previous, apps_previous),
        )

    async def get_or_create_test_accounts(self) -> list[TestAccount]:
        """Devuelve las cuentas de prueba (trabajador y comercio) para que la
        administradora testee cada rol vía "Ver como", creándolas la primera
        vez que se piden (get-or-create, mismo patrón que
        `IdentityService.guest_login`)."""
        accounts = []
        for role, (email, name) in TEST_ACCOUNTS.items():
            user = await self._users.get_by_email(email)
            if user is None:
                user = await self._users.add(
                    User(
                        email=email,
                        hashed_password=_local_password(),
                        full_name=name,
                        role=role,
                        is_verified=True,
                    )
                )
            accounts.append(
                TestAccount(id=user.id, email=user.email, full_name=user.full_name, role=user.role)
            )
        return accounts

    async def get_subscription_stats(self) -> SubscriptionStats:
        """Ingreso mensual recurrente (MRR) y distribución de comercios por
        plan (ADR-0005), para el panel de administración.

        Un comercio sin fila en `subscriptions` (nunca llamó `get_or_create`,
        ver `SubscriptionRepository`) está implícitamente en el plan por defecto — se
        suma ahí usando el total real de comercios como denominador, en vez
        de sólo contar filas existentes (subestimaría ese plan)."""
        plan_status_counts = await self._subscriptions.count_by_plan_and_status()
        total_companies = await self._companies.count_total()

        companies_by_plan: dict[str, int] = {}
        subscribed_total = 0
        mrr = Decimal("0")
        for plan_code, status, count in plan_status_counts:
            companies_by_plan[plan_code] = companies_by_plan.get(plan_code, 0) + count
            subscribed_total += count
            if status == SubscriptionStatus.ACTIVA.value:
                mrr += get_plan(plan_code).price_ars * count

        companies_by_plan[DEFAULT_PLAN_CODE] = companies_by_plan.get(
            DEFAULT_PLAN_CODE, 0
        ) + max(total_companies - subscribed_total, 0)

        limits = {plan.code: plan.max_turnos_mes for plan in list_plans() if plan.max_turnos_mes is not None}
        companies_at_plan_limit = await self._subscriptions.count_at_plan_limit(
            limits, now=datetime.now(timezone.utc)
        )

        return SubscriptionStats(
            mrr_ars=mrr,
            total_companies=total_companies,
            companies_by_plan=companies_by_plan,
            companies_at_plan_limit=companies_at_plan_limit,
            billing_enabled=self._billing.enabled,
        )

    async def suspend_user(self, actor: User, user_id: UUID) -> User:
        """Suspende a un usuario. No permite que un admin se suspenda a sí mismo.

        Revoca TODAS sus sesiones de refresh activas en la misma operación
        (auditoría de seguridad, `domains/security/trees/authn-strategy.md`
        leaf L5: suspensión = revocar en todos lados, sin excepción). Sin
        esto, `is_active=False` bloquea el próximo request/refresh (ambos lo
        chequean en vivo contra la DB), pero las filas de sesión seguían sin
        marcarse revocadas — si el usuario se reactivaba después, sus
        sesiones viejas (posiblemente el dispositivo que motivó la
        suspensión) volvían a funcionar solas, sin pedir un login nuevo."""
        if actor.id == user_id:
            raise CannotModifySelfError()
        user = await self._get(user_id)
        user.suspend()
        updated = await self._users.update(user)
        await self._sessions.revoke_all_for_user(user_id)
        return updated

    async def activate_user(self, user_id: UUID) -> User:
        """Reactiva a un usuario suspendido."""
        user = await self._get(user_id)
        user.activate()
        return await self._users.update(user)

    async def verify_user(self, user_id: UUID) -> User:
        """Marca a un usuario como verificado."""
        user = await self._get(user_id)
        user.verify()
        return await self._users.update(user)

    async def promote_to_admin(self, user_id: UUID) -> User:
        """Promueve a un usuario al rol de administrador."""
        user = await self._get(user_id)
        user.promote_to_admin()
        return await self._users.update(user)

    async def impersonate(self, user_id: UUID) -> tuple[User, str]:
        """"Ver como": emite un access token del usuario destino para que la
        administradora pueda probar la app tal cual la ve un comercio o un
        trabajador real, sin conocer su contraseña.

        A propósito **no** emite refresh token ni crea `RefreshSession`: la
        sesión de impersonación es de vida corta (el TTL normal del access
        token, hoy 15 min) y no dejar rastro persistente de sesión "real" del
        usuario impersonado. No se puede impersonar a otro admin (evita
        escalada/confusión de sesiones). El llamador (capa API) registra el
        evento en el log de auditoría — este método no lo hace porque no
        conoce quién es la administradora que lo pidió."""
        user = await self._get(user_id)
        if user.role == UserRole.ADMIN:
            raise CannotImpersonateAdminError()
        token = create_access_token(str(user.id), extra_claims={"role": user.role.value})
        return user, token

    async def _get(self, user_id: UUID) -> User:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise TargetUserNotFoundError()
        return user
