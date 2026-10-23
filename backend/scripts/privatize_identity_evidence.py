"""Pasa a privados los documentos de identidad pendientes y BORRA los que ya se
decidieron (ADR-0021).

Hasta el ADR-0021 el DNI, la selfie y la constancia de AFIP subían a
Cloudinary con entrega pública (`type=upload`): cualquiera con el link los
veía. Y hasta el borrado al decidir (ADR-0021, «Borrado al decidir»), aprobar
o rechazar sólo borraba el puntero en la base: el archivo quedaba en
Cloudinary. Las subidas y decisiones nuevas ya están bien; este script arregla
lo de antes:

1. **Evidencias pendientes en la base** (`identity_evidences.data_url` con una
   URL pública): cambia el archivo a `private` con el método `rename` de la
   Upload API de Cloudinary (mismo `public_id`, `to_type=private`,
   `invalidate=true` para sacarlo de la caché del CDN) y guarda en la fila la
   referencia privada (`file_*`), borrando la URL. Siguen esperando la
   revisión del admin.
2. **Archivos huérfanos de las carpetas `oido/identidad/` y
   `oido/constancias/`** (públicos o privados) que ninguna evidencia de la
   base apunta: son de claims ya decididos (la decisión borró el puntero pero
   no el archivo) o subidas que nunca se enviaron. Los **borra** con
   `destroy` de la Upload API (`invalidate=true`). Nunca toca un archivo que
   apunte una evidencia, ni uno subido hace menos de `ORPHAN_MIN_AGE` (puede
   ser de alguien que está por enviar su DNI).

**Es idempotente:** una fila ya migrada no se vuelve a tocar, un archivo que
ya es privado sólo actualiza la fila, y un huérfano borrado ya no aparece. Si
se corta a la mitad, se vuelve a correr.

**Por defecto NO cambia nada** (dry-run): lista lo que haría. Para hacerlo de
verdad, `--apply`. Cómo correrlo en producción: ver
`docs/adr/ADR-0021-documentos-de-identidad-privados.md` ("Migración").

    cd backend
    python -m scripts.privatize_identity_evidence           # sólo mira
    python -m scripts.privatize_identity_evidence --apply   # cambia y borra

Necesita `DATABASE_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y
`CLOUDINARY_API_SECRET`.
"""

from __future__ import annotations

import argparse
import asyncio
import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Protocol

import httpx
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core import cloudinary as cld
from app.core.config import settings
from app.modules.verification.infrastructure.models import IdentityEvidenceModel

PRIVATE = cld.PRIVATE_DELIVERY_TYPE
FOLDERS_TO_SWEEP = (cld.FOLDERS["identity"], cld.FOLDERS["business_document"])
RESOURCE_TYPES = ("image", "raw")
DELIVERY_TYPES = ("upload", PRIVATE, "authenticated")
# Un archivo más nuevo que esto no se borra aunque nadie lo apunte: la app
# sube primero a Cloudinary y recién después envía la referencia, así que
# puede ser de alguien que está completando el formulario.
ORPHAN_MIN_AGE = timedelta(hours=24)

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
    # Cuándo se subió (lo da la Admin API). `None` = no se sabe: no se borra.
    created_at: datetime | None = None


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

    def list_files(self, folder: str, resource_type: str) -> Iterable[Asset]:
        """Todos los archivos de esa carpeta, públicos o privados."""

    def make_private(self, asset: Asset) -> None:
        """Cambia el archivo a `type=private` (mismo `public_id`)."""

    def delete(self, asset: Asset) -> None:
        """Borra el archivo (`destroy`). Que ya no exista cuenta como borrado."""


class HttpCloudinaryAdmin:
    """Cliente real: Admin API (lectura, autenticación básica) + `rename` y
    `destroy` de la Upload API (firmados). Sin el SDK, igual que
    `app/core/cloudinary.py`.

    - Leer un archivo: `GET /resources/<rt>/<type>/<public_id>`.
    - Listar por carpeta: `GET /resources/<rt>/<type>?prefix=<carpeta>/` para
      cada tipo de entrega y, para las cuentas con carpetas dinámicas (donde
      la carpeta no siempre está en el `public_id`),
      `GET /resources/by_asset_folder`.
    - Cambiar el tipo: `POST /<rt>/rename` con `from_public_id` =
      `to_public_id`, `type=upload`, `to_type=private`, `invalidate=true`.
    - Borrar: `POST /<rt>/destroy` con `public_id`, `type` e
      `invalidate=true` (`cld.destroy_request`, el mismo que usa la app).
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
            created_at=_parse_created_at(raw.get("created_at")),
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

    def list_files(self, folder: str, resource_type: str) -> Iterable[Asset]:
        seen: set[tuple[str, str]] = set()
        for delivery_type in DELIVERY_TYPES:
            for raw in self._paginate(
                f"{self._base}/resources/{resource_type}/{delivery_type}",
                {"prefix": f"{folder}/"},
            ):
                asset = self._asset(raw)
                seen.add((asset.type, asset.public_id))
                yield asset
        try:
            for raw in self._paginate(
                f"{self._base}/resources/by_asset_folder", {"asset_folder": folder}
            ):
                asset = self._asset(raw)
                if (
                    asset.resource_type == resource_type
                    and (asset.type, asset.public_id) not in seen
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

    def delete(self, asset: Asset) -> None:
        url, params = cld.destroy_request(asset.public_id, asset.resource_type, asset.type)
        response = self._client.post(url, data=params)
        response.raise_for_status()
        cld.check_destroy_result(response.json())


def _parse_created_at(value: object) -> datetime | None:
    """`2026-10-20T12:34:56Z` → datetime con zona. `None` si no se entiende."""
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


@dataclass
class Report:
    rows_migrated: int = 0
    files_made_private: int = 0
    already_private: int = 0
    orphans_deleted: int = 0
    recent_skipped: int = 0
    problems: list[str] = field(default_factory=list)


async def _referenced_public_ids(session: AsyncSession) -> set[str]:
    """Los `public_id` que apunta alguna evidencia de la base (las de claims
    pendientes: las decididas ya no apuntan nada). Esos no se borran nunca.
    Se compara sólo el `public_id`, sin el tipo: ante la duda, no se borra."""
    rows = (
        await session.execute(
            select(IdentityEvidenceModel.file_public_id, IdentityEvidenceModel.data_url).where(
                or_(
                    IdentityEvidenceModel.file_public_id.is_not(None),
                    IdentityEvidenceModel.data_url.is_not(None),
                )
            )
        )
    ).all()
    referenced: set[str] = set()
    for file_public_id, data_url in rows:
        if file_public_id:
            referenced.add(file_public_id)
        parsed = parse_cloudinary_url(data_url or "")
        if parsed is not None:
            referenced.add(parsed.public_id)
    return referenced


async def run(
    session_factory: async_sessionmaker[AsyncSession],
    admin: CloudinaryAdmin,
    apply: bool,
    out: Callable[[str], None] = print,
    now: datetime | None = None,
) -> Report:
    report = Report()
    now = now or datetime.now(UTC)
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

    # 2) Huérfanos de las carpetas de identidad: se borran. Lo que apunta la
    #    base (después del paso 1) no se toca.
    async with session_factory() as session:
        referenced = await _referenced_public_ids(session)
    referenced |= {public_id for _rt, public_id in handled}
    delete_verb = "se borra" if apply else "se borraría"
    seen: set[tuple[str, str, str]] = set()
    for folder in FOLDERS_TO_SWEEP:
        for resource_type in RESOURCE_TYPES:
            for asset in list(admin.list_files(folder, resource_type)):
                key = (asset.resource_type, asset.type, asset.public_id)
                if key in seen or asset.public_id in referenced:
                    continue
                seen.add(key)
                if asset.created_at is None or now - asset.created_at < ORPHAN_MIN_AGE:
                    report.recent_skipped += 1
                    continue
                out(f"archivo {asset.public_id} ({asset.type}): huérfano, {delete_verb}")
                if apply:
                    try:
                        admin.delete(asset)
                    except (httpx.HTTPError, cld.CloudinaryDestroyError) as exc:
                        report.problems.append(
                            f"archivo {asset.public_id}: no se pudo borrar ({exc})"
                        )
                        continue
                report.orphans_deleted += 1

    mode = "APLICADO" if apply else "DRY-RUN (no se cambió nada; --apply para hacerlo)"
    orphans = "huérfanos borrados" if apply else "huérfanos a borrar"
    out(
        f"[{mode}] filas migradas: {report.rows_migrated} · archivos a privado: "
        f"{report.files_made_private} · ya privados: {report.already_private} · "
        f"{orphans}: {report.orphans_deleted} · recientes sin tocar: "
        f"{report.recent_skipped} · problemas: {len(report.problems)}"
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
