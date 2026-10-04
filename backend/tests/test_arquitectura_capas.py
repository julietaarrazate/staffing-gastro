"""Candado de capas: el CI falla si alguien mezcla dominio, aplicación e
infraestructura (PRINCIPLES.md §5–6, ARCHITECTURE.md "Reglas de dependencia").

Lee los imports con `ast` (no importa los módulos, así que también ve los
imports adentro de funciones) y aplica tres reglas:

1. `domain/` no importa frameworks, infraestructura ni capas de afuera.
2. `application/` no importa frameworks web/DB, clientes HTTP ni adaptadores
   (`*.infrastructure`, `*.api`, sesión de base, JWT, websockets).
3. El cliente de Gemini (`app.core.gemini`) sólo se usa detrás de un puerto,
   desde `infrastructure/`.

`EXCEPCIONES` lista las fugas que ya existían cuando se puso el candado
(2026-10-04). No se agregan entradas nuevas: una fuga nueva se arregla. Cuando
se cierra una, se borra su entrada — el test falla si una excepción ya no hace
falta, para que la lista sólo pueda achicarse.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1] / "app"
MODULES = APP / "modules"

FRAMEWORKS = (
    "sqlalchemy",
    "fastapi",
    "starlette",
    "httpx",
    "requests",
    "jwt",
    "passlib",
)

# app.core.* que es infraestructura (DB, red, secretos, sockets). El resto de
# core (dt, tz, geo, config) son helpers puros o configuración y se permiten.
CORE_INFRA = (
    "app.core.database",
    "app.core.security",
    "app.core.gemini",
    "app.core.ws_manager",
)

REGLAS = {
    "domain": FRAMEWORKS
    + ("pydantic", "app.core.config")
    + CORE_INFRA,
    "application": FRAMEWORKS + CORE_INFRA,
}

# (archivo relativo a app/modules, import prohibido) — fugas preexistentes.
# Ver docs/foundation/PRINCIPLES.md §6 para el plan de cada una.
EXCEPCIONES: set[tuple[str, str]] = {
    # El scheduler abre sesiones y arma repos SQLAlchemy de 9 módulos.
    ("shift/application/scheduler.py", "app.core.database"),
    ("shift/application/scheduler.py", "app.modules.application.infrastructure"),
    ("shift/application/scheduler.py", "app.modules.company.infrastructure"),
    ("shift/application/scheduler.py", "app.modules.favorite.infrastructure"),
    ("shift/application/scheduler.py", "app.modules.identity.infrastructure"),
    ("shift/application/scheduler.py", "app.modules.matching.infrastructure"),
    ("shift/application/scheduler.py", "app.modules.notification.infrastructure"),
    ("shift/application/scheduler.py", "app.modules.shift.infrastructure"),
    ("shift/application/scheduler.py", "app.modules.subscription.infrastructure"),
    ("shift/application/scheduler.py", "app.modules.worker.infrastructure"),
    # Chat empuja por websocket desde el caso de uso.
    ("chat/application/services.py", "app.core.ws_manager"),
    # JWT y bcrypt directo, sin puerto de credenciales.
    ("identity/application/services.py", "app.core.security"),
    ("identity/application/services.py", "jwt"),
    ("admin/application/services.py", "app.core.security"),
    # Gemini llamado desde las rutas, sin puerto.
    ("shift/api/routes.py", "app.core.gemini"),
    ("support/api/routes.py", "app.core.gemini"),
    ("assistant/api/routes.py", "app.core.gemini"),
}


def _imports(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            found.add(node.module)
    return found


def _matches(module: str, prohibido: str) -> bool:
    return module == prohibido or module.startswith(prohibido + ".")


def _capa_externa(module: str) -> str | None:
    """`app.modules.<x>.infrastructure|api` → ese prefijo; si no, None."""
    parts = module.split(".")
    if len(parts) >= 4 and parts[:2] == ["app", "modules"] and parts[3] in (
        "infrastructure",
        "api",
    ):
        return ".".join(parts[:4])
    return None


def _violaciones() -> set[tuple[str, str]]:
    out: set[tuple[str, str]] = set()
    for path in sorted(MODULES.rglob("*.py")):
        rel = path.relative_to(MODULES)
        capa = rel.parts[1] if len(rel.parts) > 2 else None
        imports = _imports(path)
        for module in imports:
            if capa in REGLAS:
                for prohibido in REGLAS[capa]:
                    if _matches(module, prohibido):
                        out.add((rel.as_posix(), prohibido))
                externa = _capa_externa(module)
                if externa:
                    out.add((rel.as_posix(), externa))
                if capa == "domain" and _matches_capa(module, "application"):
                    out.add((rel.as_posix(), module))
            if capa != "infrastructure" and _matches(module, "app.core.gemini"):
                out.add((rel.as_posix(), "app.core.gemini"))
    return out


def _matches_capa(module: str, capa: str) -> bool:
    parts = module.split(".")
    return len(parts) >= 4 and parts[:2] == ["app", "modules"] and parts[3] == capa


def test_no_hay_fugas_de_capa_nuevas():
    nuevas = sorted(_violaciones() - EXCEPCIONES)
    if nuevas:
        detalle = "\n".join(f"  {archivo} importa {mod}" for archivo, mod in nuevas)
        pytest.fail(
            "Import que cruza capas (ver docs/foundation/PRINCIPLES.md §6).\n"
            "Pasalo detrás de un puerto del dominio en vez de agregarlo a "
            f"EXCEPCIONES:\n{detalle}"
        )


def test_las_excepciones_siguen_haciendo_falta():
    sobrantes = sorted(EXCEPCIONES - _violaciones())
    if sobrantes:
        detalle = "\n".join(f"  {archivo} → {mod}" for archivo, mod in sobrantes)
        pytest.fail(
            "Estas fugas ya se cerraron: borralas de EXCEPCIONES para que no "
            f"vuelvan a entrar sin que nadie lo note:\n{detalle}"
        )


def test_el_candado_detecta_una_fuga(tmp_path, monkeypatch):
    """El test no puede pasar en verde porque no mira nada."""
    falso = tmp_path / "modules" / "demo" / "domain"
    falso.mkdir(parents=True)
    (falso / "entities.py").write_text(
        "def f():\n    from sqlalchemy import select\n", encoding="utf-8"
    )
    monkeypatch.setattr(
        "tests.test_arquitectura_capas.MODULES", tmp_path / "modules"
    )
    assert ("demo/domain/entities.py", "sqlalchemy") in _violaciones()
