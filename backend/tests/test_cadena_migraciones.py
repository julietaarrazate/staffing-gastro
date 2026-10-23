"""Candado de la cadena de migraciones de Alembic.

Los tests arman el esquema con `create_all`, así que nunca recorren
`alembic/versions/`. Render sí: corre `alembic upgrade head` al deployar. Una
migración cuyo `down_revision` apunta a otra que no está en la rama, o dos
ramas que agregan la misma revisión, daban verde en CI y recién fallaban en el
deploy (pasó con 0041/0042 el 2026-10-23, en PRs paralelos).

Lee los archivos con `ScriptDirectory` (sin base de datos) y exige:

1. Todo `down_revision` existe (si no, Alembic no puede armar la cadena).
2. Una sola cabeza.
3. Un archivo por revisión, y el número del nombre coincide con su
   `revision` (dos ramas que crean "0042" chocan acá y no en el deploy).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import Script, ScriptDirectory
from alembic.util import CommandError

BACKEND = Path(__file__).resolve().parents[1]
VERSIONS = BACKEND / "alembic" / "versions"


def _script() -> ScriptDirectory:
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    return ScriptDirectory.from_config(config)


def _revisions() -> list[Script]:
    try:
        return list(_script().walk_revisions())
    except (KeyError, CommandError) as exc:
        pytest.fail(f"Cadena de migraciones rota (¿down_revision que no existe?): {exc!r}")


def test_todo_down_revision_existe():
    assert _revisions()


def test_una_sola_cabeza():
    _revisions()
    heads = _script().get_heads()
    assert len(heads) == 1, f"Más de una cabeza de migraciones: {sorted(heads)}"


def test_un_archivo_por_revision_y_nombre_coincide():
    archivos = sorted(p.name for p in VERSIONS.glob("*.py") if p.name != "__init__.py")
    revisiones = _revisions()
    assert len(archivos) == len(revisiones), (
        f"Hay {len(archivos)} archivos y {len(revisiones)} revisiones: "
        "dos archivos declaran la misma revision"
    )
    distintos = [
        (Path(rev.path).name, rev.revision)
        for rev in revisiones
        if Path(rev.path).name.split("_", 1)[0] != rev.revision
    ]
    assert not distintos, f"Archivo y revision no coinciden: {distintos}"
