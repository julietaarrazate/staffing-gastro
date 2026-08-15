"""Carga datos de prueba: comercios y trabajadores repartidos por Buenos Aires.

Pensado para probar manualmente el matching/búsqueda por mapa (rol + distancia)
y la visualización de perfiles, sin tener que crear cuentas a mano una por una.

Uso:
    cd backend
    python -m scripts.seed_demo_data

Es idempotente: si un email ya existe, se omite ese registro y se sigue con
el resto. Usa la misma `DATABASE_URL` configurada en `.env`/entorno.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.modules.application.infrastructure.repositories import (
    SqlAlchemyShiftApplicationRepository,
)
from app.modules.company.application.dtos import CompanyProfileData
from app.modules.company.application.services import CompanyProfileService
from app.modules.company.domain.exceptions import CompanyProfileAlreadyExistsError
from app.modules.company.domain.value_objects import CompanyCategory
from app.modules.company.infrastructure.repositories import (
    SqlAlchemyCompanyProfileRepository,
)
from app.modules.identity.application.dtos import RegisterCommand
from app.modules.identity.application.services import IdentityService
from app.modules.identity.domain.exceptions import EmailAlreadyExistsError
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.google_token_verifier import (
    GoogleTokenInfoVerifier,
)
from app.modules.identity.infrastructure.models import UserModel
from app.modules.identity.infrastructure.repositories import (
    SqlAlchemyPasswordResetTokenRepository,
    SqlAlchemyRefreshSessionRepository,
    SqlAlchemyUserRepository,
)
from app.modules.notification.infrastructure.null_email_sender import NullEmailSender
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.shift.application.dtos import ShiftData
from app.modules.shift.application.services import ShiftService
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.subscription.infrastructure.repositories import (
    SqlAlchemySubscriptionRepository,
)
from app.modules.worker.application.dtos import WorkerProfileData
from app.modules.worker.application.services import WorkerProfileService
from app.modules.worker.domain.exceptions import WorkerProfileAlreadyExistsError
from app.modules.worker.domain.value_objects import WorkerSkill
from app.modules.worker.infrastructure.repositories import (
    SqlAlchemyWorkerProfileRepository,
)

DEMO_PASSWORD = "staffyaDemo123"

# Fotos temáticas de gastronomía por rubro (LoremFlickr: imágenes reales por
# palabra clave, estables con ?lock=N). No se scrapea Google Maps.
_CATEGORY_KEYWORD = {
    CompanyCategory.BAR: "bar,drinks",
    CompanyCategory.RESTAURANTE: "restaurant,food",
    CompanyCategory.CAFETERIA: "cafe,coffee",
    CompanyCategory.SALON_EVENTOS: "event,party",
    CompanyCategory.CATERING: "catering,buffet",
    CompanyCategory.EMPRESA_GASTRONOMICA: "restaurant,kitchen",
}


def _company_photo(category: CompanyCategory, lock: int) -> str:
    keyword = _CATEGORY_KEYWORD.get(category, "restaurant")
    return f"https://loremflickr.com/600/400/{keyword}?lock={lock + 10}"

# Comercios ficticios repartidos por distintos barrios de CABA. Direcciones y
# coordenadas son aproximadas a cada barrio (no son negocios reales: son datos
# de prueba hasta tener altas reales).
COMPANIES = [
    {
        "email": "demo.palermo@staffya.com",
        "full_name": "Bar Palermo Soho",
        "name": "Bar Palermo Soho",
        "category": CompanyCategory.BAR,
        "city": "Palermo",
        "address": "Honduras 4900",
        "latitude": -34.5885,
        "longitude": -58.4308,
        "capacity": 80,
        "description": "Bar de tragos de autor en el corazón de Palermo Soho.",
    },
    {
        "email": "demo.recoleta@staffya.com",
        "full_name": "Restó Recoleta",
        "name": "Restó Recoleta",
        "category": CompanyCategory.RESTAURANTE,
        "city": "Recoleta",
        "address": "Av. Las Heras 2200",
        "latitude": -34.5895,
        "longitude": -58.3925,
        "capacity": 60,
        "description": "Cocina de mercado y carta de vinos en Recoleta.",
    },
    {
        "email": "demo.santelmo@staffya.com",
        "full_name": "Café San Telmo",
        "name": "Café San Telmo",
        "category": CompanyCategory.CAFETERIA,
        "city": "San Telmo",
        "address": "Defensa 850",
        "latitude": -34.6210,
        "longitude": -58.3731,
        "capacity": 40,
        "description": "Café de especialidad en una casona de San Telmo.",
    },
    {
        "email": "demo.belgrano@staffya.com",
        "full_name": "Cantina Belgrano",
        "name": "Cantina Belgrano",
        "category": CompanyCategory.RESTAURANTE,
        "city": "Belgrano",
        "address": "Av. Cabildo 2100",
        "latitude": -34.5631,
        "longitude": -58.4566,
        "capacity": 70,
        "description": "Cantina familiar con cocina italiana en Belgrano.",
    },
    {
        "email": "demo.caballito@staffya.com",
        "full_name": "Eventos Caballito",
        "name": "Eventos Caballito",
        "category": CompanyCategory.SALON_EVENTOS,
        "city": "Caballito",
        "address": "Av. Rivadavia 5200",
        "latitude": -34.6190,
        "longitude": -58.4420,
        "capacity": 200,
        "description": "Salón de eventos para casamientos y fiestas corporativas.",
    },
    {
        "email": "demo.microcentro@staffya.com",
        "full_name": "Bar Microcentro",
        "name": "Bar Microcentro",
        "category": CompanyCategory.BAR,
        "city": "Microcentro",
        "address": "Florida 500",
        "latitude": -34.5995,
        "longitude": -58.3753,
        "capacity": 50,
        "description": "Bar de oficinistas en pleno Microcentro porteño.",
    },
    {
        "email": "demo.villacrespo@staffya.com",
        "full_name": "Cervecería Villa Crespo",
        "name": "Cervecería Villa Crespo",
        "category": CompanyCategory.BAR,
        "city": "Villa Crespo",
        "address": "Av. Corrientes 5100",
        "latitude": -34.5990,
        "longitude": -58.4390,
        "capacity": 90,
        "description": "Cervecería artesanal con barra y patio al fondo.",
    },
    {
        "email": "demo.almagro@staffya.com",
        "full_name": "Pizzería Almagro",
        "name": "Pizzería Almagro",
        "category": CompanyCategory.RESTAURANTE,
        "city": "Almagro",
        "address": "Av. Rivadavia 3400",
        "latitude": -34.6080,
        "longitude": -58.4190,
        "capacity": 55,
        "description": "Pizzería de barrio con horno a leña, abierta hasta tarde.",
    },
    {
        "email": "demo.puertomadero@staffya.com",
        "full_name": "Catering Puerto Madero",
        "name": "Catering Puerto Madero",
        "category": CompanyCategory.CATERING,
        "city": "Puerto Madero",
        "address": "Av. Alicia Moreau de Justo 1900",
        "latitude": -34.6080,
        "longitude": -58.3650,
        "capacity": 150,
        "description": "Catering corporativo para eventos sobre los diques.",
    },
    {
        "email": "demo.nunez@staffya.com",
        "full_name": "Café Núñez",
        "name": "Café Núñez",
        "category": CompanyCategory.CAFETERIA,
        "city": "Núñez",
        "address": "Av. Cabildo 3700",
        "latitude": -34.5450,
        "longitude": -58.4630,
        "capacity": 35,
        "description": "Cafetería de especialidad cerca del Monumental.",
    },
    {
        "email": "demo.boedo@staffya.com",
        "full_name": "Bodegón Boedo",
        "name": "Bodegón Boedo",
        "category": CompanyCategory.RESTAURANTE,
        "city": "Boedo",
        "address": "Av. Boedo 1100",
        "latitude": -34.6280,
        "longitude": -58.4170,
        "capacity": 65,
        "description": "Bodegón tradicional con cocina porteña de toda la vida.",
    },
    {
        "email": "demo.colegiales@staffya.com",
        "full_name": "Empresa Gastronómica Colegiales",
        "name": "Empresa Gastronómica Colegiales",
        "category": CompanyCategory.EMPRESA_GASTRONOMICA,
        "city": "Colegiales",
        "address": "Av. Federico Lacroze 2200",
        "latitude": -34.5760,
        "longitude": -58.4480,
        "capacity": 300,
        "description": "Operador gastronómico con varios locales en CABA.",
    },
]

# Trabajadores ficticios repartidos cerca de los comercios anteriores, con
# distintos roles. `img` selecciona la foto en i.pravatar.cc.
WORKERS = [
    {
        "email": "demo.mozo.palermo@staffya.com",
        "full_name": "Lucas Fernández",
        "skills": [WorkerSkill.MOZO],
        "city": "Palermo",
        "latitude": -34.5850,
        "longitude": -58.4280,
        "years_experience": 3,
        "img": 12,
    },
    {
        "email": "demo.bartender.palermo@staffya.com",
        "full_name": "Martina Gómez",
        "skills": [WorkerSkill.BARTENDER],
        "city": "Palermo",
        "latitude": -34.5910,
        "longitude": -58.4330,
        "years_experience": 5,
        "img": 47,
    },
    {
        "email": "demo.barista.recoleta@staffya.com",
        "full_name": "Sofía Acosta",
        "skills": [WorkerSkill.BARISTA],
        "city": "Recoleta",
        "latitude": -34.5880,
        "longitude": -58.3950,
        "years_experience": 2,
        "img": 65,
    },
    {
        "email": "demo.runner.santelmo@staffya.com",
        "full_name": "Bruno Silva",
        "skills": [WorkerSkill.RUNNER],
        "city": "San Telmo",
        "latitude": -34.6230,
        "longitude": -58.3710,
        "years_experience": 1,
        "img": 22,
    },
    {
        "email": "demo.cocinero.belgrano@staffya.com",
        "full_name": "Camila Rodríguez",
        "skills": [WorkerSkill.COCINERO],
        "city": "Belgrano",
        "latitude": -34.5610,
        "longitude": -58.4540,
        "years_experience": 6,
        "img": 33,
    },
    {
        "email": "demo.mozo.caballito@staffya.com",
        "full_name": "Tomás Pereyra",
        "skills": [WorkerSkill.MOZO, WorkerSkill.PERSONAL_EVENTOS],
        "city": "Caballito",
        "latitude": -34.6170,
        "longitude": -58.4400,
        "years_experience": 4,
        "img": 51,
    },
    {
        "email": "demo.bartender.microcentro@staffya.com",
        "full_name": "Valentina López",
        "skills": [WorkerSkill.BARTENDER, WorkerSkill.MOZO],
        "city": "Microcentro",
        "latitude": -34.6010,
        "longitude": -58.3770,
        "years_experience": 7,
        "img": 28,
    },
    {
        "email": "demo.barista.palermo@staffya.com",
        "full_name": "Julieta Sosa",
        "skills": [WorkerSkill.BARISTA, WorkerSkill.CAJERO],
        "city": "Palermo",
        "latitude": -34.5870,
        "longitude": -58.4350,
        "years_experience": 1,
        "img": 19,
    },
    {
        "email": "demo.cocinero.villacrespo@staffya.com",
        "full_name": "Federico Romero",
        "skills": [WorkerSkill.COCINERO, WorkerSkill.AYUDANTE_COCINA],
        "city": "Villa Crespo",
        "latitude": -34.5995,
        "longitude": -58.4370,
        "years_experience": 8,
        "img": 36,
    },
    {
        "email": "demo.mozo.almagro@staffya.com",
        "full_name": "Agustina Díaz",
        "skills": [WorkerSkill.MOZO, WorkerSkill.RECEPCIONISTA],
        "city": "Almagro",
        "latitude": -34.6090,
        "longitude": -58.4200,
        "years_experience": 2,
        "img": 41,
    },
    {
        "email": "demo.eventos.puertomadero@staffya.com",
        "full_name": "Nicolás Aguirre",
        "skills": [WorkerSkill.PERSONAL_EVENTOS, WorkerSkill.PERSONAL_SALON],
        "city": "Puerto Madero",
        "latitude": -34.6070,
        "longitude": -58.3660,
        "years_experience": 5,
        "img": 60,
    },
    {
        "email": "demo.barista.nunez@staffya.com",
        "full_name": "Lucía Medina",
        "skills": [WorkerSkill.BARISTA],
        "city": "Núñez",
        "latitude": -34.5460,
        "longitude": -58.4610,
        "years_experience": 3,
        "img": 8,
    },
    {
        "email": "demo.mozo.boedo@staffya.com",
        "full_name": "Matías Cabrera",
        "skills": [WorkerSkill.MOZO, WorkerSkill.CAJERO],
        "city": "Boedo",
        "latitude": -34.6270,
        "longitude": -58.4150,
        "years_experience": 4,
        "img": 15,
    },
    {
        "email": "demo.cocinero.colegiales@staffya.com",
        "full_name": "Florencia Torres",
        "skills": [WorkerSkill.COCINERO, WorkerSkill.PERSONAL_SALON],
        "city": "Colegiales",
        "latitude": -34.5770,
        "longitude": -58.4460,
        "years_experience": 6,
        "img": 24,
    },
]


async def _existing_emails(session: AsyncSession, emails: list[str]) -> set[str]:
    """Emails ya registrados de la lista dada, en UNA sola consulta
    (`WHERE email IN (...)`).

    R-perf (docs/audits/PERFORMANCE_REPORT.md, "Seed en cada arranque"): antes cada
    entrada demo (comercio o trabajador) pagaba su propio `exists_by_email`
    dentro de `identity_service.register` — con `SEED_DEMO_DATA=true` en cada
    boot, eso son 26 round-trips SECUENCIALES a una base remota (Neon) sólo
    para descubrir que ya existen y no hay nada que hacer. Con esto se sabe
    de antemano, en una consulta, cuáles saltarse SIN llamar a `register` en
    absoluto (que ya no dispara ninguna query para esas filas)."""
    if not emails:
        return set()
    stmt = select(UserModel.email).where(
        UserModel.email.in_([email.lower() for email in emails])
    )
    result = await session.execute(stmt)
    return {row[0] for row in result.all()}


async def _seed_companies(session) -> set[str]:
    """Crea comercios demo. Devuelve los emails recién creados (para que el
    seed de turnos sólo siembre para comercios nuevos y sea idempotente)."""
    users = SqlAlchemyUserRepository(session)
    companies = SqlAlchemyCompanyProfileRepository(session)
    identity_service = IdentityService(
        users,
        SqlAlchemyRefreshSessionRepository(session),
        SqlAlchemyPasswordResetTokenRepository(session),
        NullEmailSender(),
        GoogleTokenInfoVerifier(settings),
    )
    company_service = CompanyProfileService(companies)
    created: set[str] = set()

    already_registered = await _existing_emails(
        session, [entry["email"] for entry in COMPANIES]
    )

    for i, entry in enumerate(COMPANIES):
        if entry["email"].lower() in already_registered:
            print(f"  [omitido] {entry['email']} ya existe")
            continue
        try:
            user = await identity_service.register(
                RegisterCommand(
                    email=entry["email"],
                    password=DEMO_PASSWORD,
                    full_name=entry["full_name"],
                    role=UserRole.EMPLOYER,
                )
            )
        except EmailAlreadyExistsError:
            print(f"  [omitido] {entry['email']} ya existe")
            continue

        try:
            await company_service.create_profile(
                user.id,
                CompanyProfileData(
                    name=entry["name"],
                    logo_url=_company_photo(entry["category"], i),
                    category=entry["category"],
                    description=entry["description"],
                    city=entry["city"],
                    address=entry["address"],
                    latitude=entry["latitude"],
                    longitude=entry["longitude"],
                    capacity=entry["capacity"],
                ),
            )
            created.add(entry["email"])
            print(f"  [ok] comercio {entry['name']} ({entry['city']})")
        except CompanyProfileAlreadyExistsError:
            print(f"  [omitido] perfil de {entry['email']} ya existe")

    return created


async def _seed_workers(session) -> None:
    users = SqlAlchemyUserRepository(session)
    workers = SqlAlchemyWorkerProfileRepository(session)
    identity_service = IdentityService(
        users,
        SqlAlchemyRefreshSessionRepository(session),
        SqlAlchemyPasswordResetTokenRepository(session),
        NullEmailSender(),
        GoogleTokenInfoVerifier(settings),
    )
    worker_service = WorkerProfileService(workers, SqlAlchemyShiftRepository(session))

    already_registered = await _existing_emails(
        session, [entry["email"] for entry in WORKERS]
    )

    for entry in WORKERS:
        if entry["email"].lower() in already_registered:
            print(f"  [omitido] {entry['email']} ya existe")
            continue
        try:
            user = await identity_service.register(
                RegisterCommand(
                    email=entry["email"],
                    password=DEMO_PASSWORD,
                    full_name=entry["full_name"],
                    role=UserRole.WORKER,
                )
            )
        except EmailAlreadyExistsError:
            print(f"  [omitido] {entry['email']} ya existe")
            continue

        try:
            await worker_service.create_profile(
                user.id,
                WorkerProfileData(
                    photo_url=f"https://i.pravatar.cc/300?img={entry['img']}",
                    skills=entry["skills"],
                    city=entry["city"],
                    latitude=entry["latitude"],
                    longitude=entry["longitude"],
                    years_experience=entry["years_experience"],
                    is_available=True,
                ),
            )
            print(f"  [ok] trabajador {entry['full_name']} ({entry['city']})")
        except WorkerProfileAlreadyExistsError:
            print(f"  [omitido] perfil de {entry['email']} ya existe")


# Turnos demo publicados, para que el Inicio del trabajador tenga oportunidades
# que deslizar. (email del comercio, puesto, cantidad, pago, urgente, dress code)
# `cantidad` queda fija en 1: un turno = una persona (R1.4), la API la capa.
SHIFTS = [
    ("demo.palermo@staffya.com", WorkerSkill.BARTENDER, 1, 18000, True, "Negro formal"),
    ("demo.palermo@staffya.com", WorkerSkill.MOZO, 1, 15000, False, "Camisa blanca"),
    ("demo.recoleta@staffya.com", WorkerSkill.MOZO, 1, 16000, False, "Elegante sport"),
    ("demo.recoleta@staffya.com", WorkerSkill.COCINERO, 1, 22000, True, None),
    ("demo.santelmo@staffya.com", WorkerSkill.BARISTA, 1, 14000, False, "Delantal del local"),
    ("demo.belgrano@staffya.com", WorkerSkill.RUNNER, 1, 12000, False, None),
    ("demo.caballito@staffya.com", WorkerSkill.PERSONAL_EVENTOS, 1, 17000, True, "Uniforme provisto"),
    ("demo.microcentro@staffya.com", WorkerSkill.CAJERO, 1, 15000, False, None),
    ("demo.villacrespo@staffya.com", WorkerSkill.BARTENDER, 1, 19000, False, "Casual"),
    ("demo.almagro@staffya.com", WorkerSkill.MOZO, 1, 15500, True, "Remera del local"),
    ("demo.puertomadero@staffya.com", WorkerSkill.PERSONAL_EVENTOS, 1, 20000, True, "Uniforme provisto"),
    ("demo.nunez@staffya.com", WorkerSkill.BARISTA, 1, 14500, False, None),
    ("demo.boedo@staffya.com", WorkerSkill.MOZO, 1, 15000, False, "Mandil del bodegón"),
    ("demo.colegiales@staffya.com", WorkerSkill.COCINERO, 1, 23000, True, None),
]


async def _seed_shifts(session, created_company_emails: set[str]) -> None:
    """Publica turnos demo, sólo para los comercios recién creados (idempotente)."""
    if not created_company_emails:
        print("  [omitido] no hay comercios nuevos: no se siembran turnos")
        return

    users = SqlAlchemyUserRepository(session)
    companies = SqlAlchemyCompanyProfileRepository(session)
    service = ShiftService(
        shifts=SqlAlchemyShiftRepository(session),
        workers=SqlAlchemyWorkerProfileRepository(session),
        companies=companies,
        notifications=SqlAlchemyNotificationRepository(session),
        applications=SqlAlchemyShiftApplicationRepository(session),
        subscriptions=SqlAlchemySubscriptionRepository(session),
        users=users,
        email_sender=NullEmailSender(),
    )
    by_email = {c["email"]: c for c in COMPANIES}
    start = datetime.now(UTC) + timedelta(hours=5)

    for email, position, qty, pay, urgent, dress in SHIFTS:
        if email not in created_company_emails:
            continue
        user = await users.get_by_email(email)
        if user is None:
            continue
        company = await companies.get_by_user_id(user.id)
        if company is None:
            continue
        meta = by_email[email]
        shift = await service.create_shift(
            company.id,
            ShiftData(
                position=position,
                quantity=qty,
                start_at=start,
                end_at=start + timedelta(hours=6),
                pay_amount=Decimal(str(pay)),
                currency="ARS",
                tips=True,
                dress_code=dress,
                urgent=urgent,
                address=meta["address"],
                city=meta["city"],
                latitude=meta["latitude"],
                longitude=meta["longitude"],
                title=None,
                description="Turno de demostración para probar la app.",
            ),
        )
        await service.publish_shift(company.id, shift.id)
        print(f"  [ok] turno {position.value} en {meta['city']}")
        start += timedelta(hours=2)


async def main() -> None:
    async with AsyncSessionLocal() as session:
        print("Comercios de prueba:")
        created = await _seed_companies(session)
        print("Trabajadores de prueba:")
        await _seed_workers(session)
        print("Turnos de prueba:")
        await _seed_shifts(session, created)
    print(f"\nListo. Contraseña de todas las cuentas demo: {DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
