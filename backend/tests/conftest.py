"""Fixtures de pytest: base de datos SQLite en memoria y cliente HTTP async."""

from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.core.database import Base, get_session
from app.main import app

# El rate limiting de login/registro es por IP y global al proceso; los tests
# comparten la IP del cliente ASGI, así que se desactiva salvo en el test que
# lo ejercita explícitamente (test_identity::test_rate_limit_*).
settings.rate_limit_enabled = False

# Importar modelos para registrarlos en la metadata antes de create_all
from app.modules.application.infrastructure import models as application_models  # noqa: F401
from app.modules.chat.infrastructure import models as chat_models  # noqa: F401
from app.modules.company.infrastructure import models as company_models  # noqa: F401
from app.modules.identity.infrastructure import models as identity_models  # noqa: F401
from app.modules.notification.infrastructure import models as notification_models  # noqa: F401
from app.modules.review.infrastructure import models as review_models  # noqa: F401
from app.modules.shift.infrastructure import models as shift_models  # noqa: F401
from app.modules.subscription.infrastructure import models as subscription_models  # noqa: F401
from app.modules.worker.infrastructure import models as worker_models  # noqa: F401

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def session_factory() -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:
    engine = create_async_engine(TEST_DATABASE_URL, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    yield factory

    await engine.dispose()


@pytest_asyncio.fixture
async def client(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# --- Helpers compartidos de registro/login/auth headers -------------------
# No son fixtures: son funciones async normales que reciben el `client` de la
# fixture de arriba. Se importan explícitamente en cada test_*.py
# (`from tests.conftest import ...`) para evitar duplicar estos patrones.

DEFAULT_PASSWORD = "supersecreta123"


async def register_user(
    client: AsyncClient,
    email: str = "mozo@staffya.com",
    password: str = DEFAULT_PASSWORD,
    full_name: str = "Juan Mozo",
    role: str = "worker",
    **overrides,
) -> Response:
    """Registra un usuario y devuelve la respuesta cruda (para inspeccionar
    status_code/body, p. ej. en tests de validación del registro)."""
    payload = {
        "email": email,
        "password": password,
        "full_name": full_name,
        "role": role,
    }
    payload.update(overrides)
    return await client.post("/api/v1/auth/register", json=payload)


async def login(client: AsyncClient, email: str, password: str = DEFAULT_PASSWORD) -> dict:
    """Inicia sesión y devuelve el body de tokens (access_token, refresh_token, token_type)."""
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    return response.json()


async def auth_headers(
    client: AsyncClient, role: str, email: str, full_name: str = "Test User"
) -> dict:
    """Registra un usuario, inicia sesión y devuelve el header Authorization listo
    para usar en requests autenticados."""
    await register_user(client, email=email, full_name=full_name, role=role)
    tokens = await login(client, email)
    return {"Authorization": f"Bearer {tokens['access_token']}"}
