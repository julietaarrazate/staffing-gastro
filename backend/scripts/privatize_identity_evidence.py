"""Pasa a privados los documentos de identidad que ya estaban subidos (ADR-0021).

Hasta el ADR-0021 el DNI, la selfie y la constancia de AFIP subían a
Cloudinary con entrega pública (`type=upload`): cualquiera con el link los
veía. Las subidas nuevas ya son privadas; este script arregla las viejas:

1. **Evidencias pendientes en la base** (`identity_evidences.data_url` con una
   URL pública): cambia el archivo a `private` con el método `rename` de la
   Upload API de Cloudinary (mismo `public_id`, `to_type=private`,
   `invalidate=true` para sacarlo de la caché del CDN) y guarda en la fila la
   referencia privada (`file_*`), borrando la URL.
2. **Archivos de las carpetas `oido/identidad/` y `oido/constancias/`** que
   sigan públicos aunque la base ya no los apunte (evidencias de claims ya
   decididos: la purga borró el puntero pero no el archivo). Los pasa a
   `private` también.

**Es idempotente:** una fila ya migrada no se vuelve a tocar, y un archivo que
ya es privado sólo actualiza la fila. Si se corta a la mitad, se vuelve a
correr.

**Por defecto NO cambia nada** (dry-run): lista lo que haría. Para hacerlo de
verdad, `--apply`. Cómo correrlo en producción: ver
`docs/adr/ADR-0021-documentos-de-identidad-privados.md` ("Migración").

    cd backend
    python -m scripts.privatize_identity_evidence           # sólo mira
    python -m scripts.privatize_identity_evidence --apply   # cambia

Necesita `DATABASE_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y
`CLOUDINARY_API_SECRET`.
"""

from __future__ import annotations

import argparse
import asyncio
import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from typing import Protocol

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core import cloudinary as cld
from app.core.config import settings
from app.modules.verification.infrastructure.models import IdentityEvidenceModel

PRIVATE = cld.PRIVATE_DELIVERY_TYPE
FOLDERS_TO_SWEEP = (cld.FOLDERS["identity"], cld.FOLDERS["business_document"])
RESOURCE_TYPES = ("image", "raw")

_URL = re.compile(
    r"^https://res\.cloudinary\.com/[^/]+/(?P<rt>image|raw|video)/"
    r"(?P<type>upload|private|authenticated)/(?P<rest>.+)$"
)
_VERSION = re.compile(r"^v\d+$")


@dataclass(frozen=True)
class Asset:
    public_id: str
    resource_type: str
    format: str
    type: str


@dataclass(frozen=True)
class ParsedUrl:
    public_id: str
    resource_type: str
    format: str
    type: str


def parse_cloudinary_url(url: str) -> ParsedUrl | None:
    """`https://res.cloudinary.com/<cloud>/image/upload/v123/oido/identidad/ab.jpg`
    → (`oido/identidad/ab`, `image`, `jpg`, `upload`). Lo que hay antes de la
    versión (`v123`) son transformaciones y se descarta. En `raw` la
    extensión es parte del `public_id` y el formato queda vacío. `None` si no
    es una URL de entrega de Cloudinary."""
    match = _URL.match(url.split("?", 1)[0])
    if not match:
        return None
    segments = match["rest"].split("/")
    for i, segment in enumerate(segments):
        if _VERSION.match(segment):
            segments = segments[i + 1 :]
            break
    path = "/".join(segments)
    if not path:
        return None
    resource_type = match["rt"]
    if resource_type == "raw" or "." not in segments[-1]:
        return ParsedUrl(path, resource_type, "", match["type"])
    public_id, file_format = path.rsplit(".", 1)
    return ParsedUrl(public_id, resource_type, file_format.lower(), match["type"])


class CloudinaryAdmin(Protocol):
    """Lo que el script necesita de Cloudinary. En los tests es un doble."""

    def find(self, public_id: str, resource_type: str) -> Asset | None:
        """El archivo, sea público o privado; `None` si no existe."""

    def list_public(self, folder: str, resource_type: str) -> Iterable[Asset]:
        """Los archivos públicos (`type=upload`) de esa carpeta."""

    def make_private(self, asset: Asset) -> None:
        """Cambia el archivo a `type=private` (mismo `public_id`)."""


class HttpCloudinaryAdmin:
    """Cliente real: Admin API (lectura, autenticación básica) + `rename` de
    la Upload API (firmado). Sin el SDK, igual que `app/core/cloudinary.py`.

    - Leer un archivo: `GET /resources/<rt>/<type>/<public_id>`.
    - Listar por carpeta: `GET /resources/<rt>/upload?prefix=<carpeta>/` y,
      para las cuentas con carpetas dinámicas (donde la carpeta no siempre
      está en el `public_id`), `GET /resources/by_asset_folder`.
    - Cambiar el tipo: `POST /<rt>/rename` con `from_public_id` =
      `to_public_id`, `type=upload`, `to_type=private`, `invalidate=true`.
    """

    def __init__(self, client: httpx.Client | None = None) -> None:
        if not (
            settings.cloudinary_cloud_name
            and settings.cloudinary_api_key
            and settings.cloudinary_api_secret
        ):
            raise cld.CloudinaryNotConfiguredError()
        self._base = f"{cld.API_BASE}/{settings.cloudinary_cloud_name}"
        self._client = client or httpx.Client(
            timeout=30.0,
            auth=(settings.cloudinary_api_key, settings.cloudinary_api_secret),
        )

    @staticmethod
    def _asset(raw: dict) -> Asset:
        return Asset(
            public_id=raw["public_id"],
            resource_type=raw.get("resource_type", "image"),
            format=raw.get("format") or "",
            type=raw.get("type", "upload"),
        )

    def find(self, public_id: str, resource_type: str) -> Asset | None:
        for delivery_type in ("upload", PRIVATE):
            response = self._client.get(
                f"{self._base}/resources/{resource_type}/{delivery_type}/{public_id}"
            )
            if response.status_code == 404:
                continue
            response.raise_for_status()
            return self._asset(response.json())
        return None

    def _paginate(self, url: str, params: dict[str, str]) -> Iterable[dict]:
        cursor: str | None = None
        while True:
            page = {**params, "max_results": "500"}
            if cursor:
                page["next_cursor"] = cursor
            response = self._client.get(url, params=page)
            response.raise_for_status()
            body = response.json()
            yield from body.get("resources", [])
            cursor = body.get("next_cursor")
            if not cursor:
                return

    def list_public(self, folder: str, resource_type: str) -> Iterable[Asset]:
        seen: set[str] = set()
        for raw in self._paginate(
            f"{self._base}/resources/{resource_type}/upload",
            {"prefix": f"{folder}/"},
        ):
            seen.add(raw["public_id"])
            yield self._asset(raw)
        try:
            for raw in self._paginate(
                f"{self._base}/resources/by_asset_folder", {"asset_folder": folder}
            ):
                asset = self._asset(raw)
                if (
                    asset.type == "upload"
                    and asset.resource_type == resource_type
                    and asset.public_id not in seen
                ):
                    yield asset
        except httpx.HTTPStatusError:
            # Cuenta con carpetas fijas: no existe `by_asset_folder`, y el
            # listado por prefijo ya alcanzó.
            return

    def make_private(self, asset: Asset) -> None:
        response = self._client.post(
            cld.api_url(asset.resource_type, "rename"),
            data=cld.signed_api_params(
                {
                    "from_public_id": asset.public_id,
                    "to_public_id": asset.public_id,
                    "type": "upload",
                    "to_type": PRIVATE,
                    "invalidate": "true",
                }
            ),
        )
        response.raise_for_status()


@dataclass
class Report:
    rows_migrated: int = 0
    files_made_private: int = 0
    already_private: int = 0
    problems: list[str] = field(default_factory=list)


async def run(
    session_factory: async_sessionmaker[AsyncSession],
    admin: CloudinaryAdmin,
    apply: bool,
    out: Callable[[str], None] = print,
) -> Report:
    report = Report()
    verb = "pasa" if apply else "pasaría"
    handled: set[tuple[str, str]] = set()

    # 1) Filas de la base que todavía guardan una URL pública.
    async with session_factory() as session:
        rows = (
            await session.execute(
                select(IdentityEvidenceModel).where(
                    IdentityEvidenceModel.data_url.is_not(None),
                    IdentityEvidenceModel.file_public_id.is_(None),
                )
            )
        ).scalars().all()
        for row in rows:
            parsed = parse_cloudinary_url(row.data_url or "")
            if parsed is None:
                report.problems.append(f"evidencia {row.id}: URL que no es de Cloudinary")
                continue
            asset = admin.find(parsed.public_id, parsed.resource_type)
            if asset is None:
                report.problems.append(
                    f"evidencia {row.id}: {parsed.public_id} no está en Cloudinary"
                )
                continue
            handled.add((asset.resource_type, asset.public_id))
            if asset.type == PRIVATE:
                report.already_private += 1
            else:
                out(f"evidencia {row.id}: {asset.public_id} {verb} a privado")
                if apply:
                    admin.make_private(asset)
                report.files_made_private += 1
            if apply:
                row.file_public_id = asset.public_id
                row.file_resource_type = asset.resource_type
                row.file_format = asset.format or parsed.format
                row.file_delivery_type = PRIVATE
                row.data_url = None
                # Una fila por commit: si algo se corta, lo hecho queda hecho.
                await session.commit()
            report.rows_migrated += 1

    # 2) Archivos de las carpetas de identidad que siguen públicos.
    for folder in FOLDERS_TO_SWEEP:
        for resource_type in RESOURCE_TYPES:
            for asset in list(admin.list_public(folder, resource_type)):
                if (asset.resource_type, asset.public_id) in handled:
                    continue
                handled.add((asset.resource_type, asset.public_id))
                out(f"archivo {asset.public_id}: {verb} a privado")
                if apply:
                    admin.make_private(asset)
                report.files_made_private += 1

    mode = "APLICADO" if apply else "DRY-RUN (no se cambió nada; --apply para hacerlo)"
    out(
        f"[{mode}] filas migradas: {report.rows_migrated} · archivos a privado: "
        f"{report.files_made_private} · ya privados: {report.already_private} · "
        f"problemas: {len(report.problems)}"
    )
    for problem in report.problems:
        out(f"  ! {problem}")
    return report


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--apply", action="store_true", help="hacer los cambios (sin esto, sólo mira)"
    )
    args = parser.parse_args(argv)

    from app.core.database import AsyncSessionLocal

    asyncio.run(run(AsyncSessionLocal, HttpCloudinaryAdmin(), apply=args.apply))


if __name__ == "__main__":
    main()
