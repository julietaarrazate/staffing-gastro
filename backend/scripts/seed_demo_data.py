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

from app.core.database import AsyncSessionLocal
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
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.worker.application.dtos import WorkerProfileData
from app.modules.worker.application.services import WorkerProfileService
from app.modules.worker.domain.exceptions import WorkerProfileAlreadyExistsError
from app.modules.worker.domain.value_objects import WorkerSkill
from app.modules.worker.infrastructure.repositories import (
    SqlAlchemyWorkerProfileRepository,
)

DEMO_PASSWORD = "staffyaDemo123"

# Comercios repartidos por distintos barrios de CABA.
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
    },
]

# Trabajadores repartidos cerca de los comercios anteriores, con distintos roles.
WORKERS = [
    {
        "email": "demo.mozo.palermo@staffya.com",
        "full_name": "Lucas Fernández",
        "skills": [WorkerSkill.MOZO],
        "city": "Palermo",
        "latitude": -34.5850,
        "longitude": -58.4280,
        "years_experience": 3,
    },
    {
        "email": "demo.bartender.palermo@staffya.com",
        "full_name": "Martina Gómez",
        "skills": [WorkerSkill.BARTENDER],
        "city": "Palermo",
        "latitude": -34.5910,
        "longitude": -58.4330,
        "years_experience": 5,
    },
    {
        "email": "demo.barista.recoleta@staffya.com",
        "full_name": "Sofía Acosta",
        "skills": [WorkerSkill.BARISTA],
        "city": "Recoleta",
        "latitude": -34.5880,
        "longitude": -58.3950,
        "years_experience": 2,
    },
    {
        "email": "demo.runner.santelmo@staffya.com",
        "full_name": "Bruno Silva",
        "skills": [WorkerSkill.RUNNER],
        "city": "San Telmo",
        "latitude": -34.6230,
        "longitude": -58.3710,
        "years_experience": 1,
    },
    {
        "email": "demo.cocinero.belgrano@staffya.com",
        "full_name": "Camila Rodríguez",
        "skills": [WorkerSkill.COCINERO],
        "city": "Belgrano",
        "latitude": -34.5610,
        "longitude": -58.4540,
        "years_experience": 6,
    },
    {
        "email": "demo.mozo.caballito@staffya.com",
        "full_name": "Tomás Pereyra",
        "skills": [WorkerSkill.MOZO, WorkerSkill.PERSONAL_EVENTOS],
        "city": "Caballito",
        "latitude": -34.6170,
        "longitude": -58.4400,
        "years_experience": 4,
    },
    {
        "email": "demo.bartender.microcentro@staffya.com",
        "full_name": "Valentina López",
        "skills": [WorkerSkill.BARTENDER, WorkerSkill.MOZO],
        "city": "Microcentro",
        "latitude": -34.6010,
        "longitude": -58.3770,
        "years_experience": 7,
    },
    {
        "email": "demo.barista.palermo@staffya.com",
        "full_name": "Julieta Sosa",
        "skills": [WorkerSkill.BARISTA, WorkerSkill.CAJERO],
        "city": "Palermo",
        "latitude": -34.5870,
        "longitude": -58.4350,
        "years_experience": 1,
    },
]


async def _seed_companies(session) -> None:
    users = SqlAlchemyUserRepository(session)
    companies = SqlAlchemyCompanyProfileRepository(session)
    identity_service = IdentityService(users)
    company_service = CompanyProfileService(companies)

    for entry in COMPANIES:
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
                    category=entry["category"],
                    city=entry["city"],
                    address=entry["address"],
                    latitude=entry["latitude"],
                    longitude=entry["longitude"],
                    capacity=entry["capacity"],
                ),
            )
            print(f"  [ok] comercio {entry['name']} ({entry['city']})")
        except CompanyProfileAlreadyExistsError:
            print(f"  [omitido] perfil de {entry['email']} ya existe")


async def _seed_workers(session) -> None:
    users = SqlAlchemyUserRepository(session)
    workers = SqlAlchemyWorkerProfileRepository(session)
    identity_service = IdentityService(users)
    worker_service = WorkerProfileService(workers)

    for entry in WORKERS:
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


async def main() -> None:
    async with AsyncSessionLocal() as session:
        print("Comercios de prueba:")
        await _seed_companies(session)
        print("Trabajadores de prueba:")
        await _seed_workers(session)
    print(f"\nListo. Contraseña de todas las cuentas demo: {DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
