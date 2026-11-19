"""Protege los CV que ya estaban subidos y BORRA los que nadie usa (ADR-0021,
«Actualización 2026-11-19: el CV también»).

Hasta el 2026-11-19 el CV del trabajador (teléfono, email, domicilio) subía a
Cloudinary con entrega pública (`type=upload`) y el perfil guardaba su URL:
quien la vio una vez la seguía abriendo para siempre, y al cambiar o sacar el
CV el archivo viejo no se borraba. Las subidas nuevas ya son `authenticated`
(ni el original ni una versión transformada se ven sin firma) y se ven con
un link que vence; este script arregla lo de antes:

1. **Perfiles con un CV viejo** (`worker_profiles.cv_url` con una URL de
   Cloudinary) **o con un CV `private`**: cambia el archivo a
   `authenticated` (`rename` de la Upload API, mismo `public_id`,
   `invalidate=true` para sacarlo de la caché del CDN) y guarda en el perfil
   la referencia protegida (`cv_*`), vaciando `cv_url`. El perfil se escribe
   sólo si sigue como estaba al leerlo: si la persona cambió el CV mientras
   corría, no se pisa (el archivo viejo queda huérfano y lo borra el paso 2
   en la próxima corrida). **No toca** (y lo lista en problemas, para
   mirarlo a mano):
   - un archivo de otra carpeta de la app (fotos de perfil, portadas,
     identidad, constancias): un link así no es un CV, y protegerlo rompería
     esa foto;
   - un archivo sin carpeta que también usa otra cosa (una foto de perfil, un
     logo, una portada o un documento de identidad);
   - un archivo que apuntan dos perfiles: si uno lo cambia, se le borraría al
     otro;
   - una URL de otra cuenta de Cloudinary.
   Un link pegado a mano (Drive, LinkedIn) no es de Cloudinary: no se toca.
2. **Huérfanos** que ningún perfil apunta, subidos hace más de 24 h (lo más
   nuevo puede ser de alguien que está guardando su perfil):
   - de la carpeta `oido/cv/` (de cualquier tipo): CV que se cambiaron o
     sacaron antes de este cambio (el archivo viejo quedaba) y subidas que
     nunca se guardaron. Se **borran** (`destroy`, `invalidate=true`);
   - **sin carpeta** (los CV de antes de las carpetas, 2026-10-15): los Word
     (`raw`) y los PDF se **borran**, salvo que los use otra cosa (eso se
     lista); las fotos (jpg, png…) que nada usa se **listan para mirarlas a
     mano** y no se tocan: pueden ser un CV en imagen o una foto vieja.

**Es idempotente:** un perfil ya migrado no se vuelve a tocar, un archivo que
ya es `authenticated` sólo actualiza el perfil, y un huérfano borrado ya no
aparece. Si se corta a la mitad, se vuelve a correr.

**Por defecto NO cambia nada** (dry-run): lista lo que haría. Para hacerlo de
verdad, `--apply`. Cómo correrlo en producción: ver
`docs/adr/ADR-0021-documentos-de-identidad-privados.md` («Actualización
2026-11-19: el CV también») y `docs/reference/PENDIENTE_OPERATIVO.md`.

    cd backend
    python -m scripts.privatize_worker_cvs           # sólo mira
    python -m scripts.privatize_worker_cvs --apply   # cambia y borra

Necesita `DATABASE_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y
`CLOUDINARY_API_SECRET`.
"""

from __future__ import annotations

import argparse
import asyncio
from collections import Counter
from collections.abc import Callable
from datetime import UTC, datetime

import httpx
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core import cloudinary as cld
from app.core.config import settings
from app.modules.company.infrastructure.models import CompanyProfileModel
from app.modules.verification.infrastructure.models import IdentityEvidenceModel
from app.modules.worker.infrastructure.models import WorkerProfileModel
from scripts.privatize_identity_evidence import (
    ORPHAN_MIN_AGE,
    RESOURCE_TYPES,
    Asset,
    CloudinaryAdmin,
    HttpCloudinaryAdmin,
    Report,
    summary,
)

PROTECTED = cld.PROTECTED_DELIVERY_TYPE
CV_FOLDER = cld.FOLDERS["cv"]
# Las otras carpetas de la app: un archivo de ahí pegado como CV no es un CV.
OTHER_FOLDERS = tuple(folder for kind, folder in cld.FOLDERS.items() if kind != "cv")


def _other_folder(asset: Asset) -> str | None:
    for folder in OTHER_FOLDERS:
        if asset.folder == folder or asset.public_id.startswith(f"{folder}/"):
            return folder
    return None


def _rootless(asset: Asset) -> bool:
    """Sin carpeta: ni en el `public_id` ni en `asset_folder`."""
    return "/" not in asset.public_id and not asset.folder


def _is_document(asset: Asset) -> bool:
    """Un Word (`raw`) o un PDF: sin carpeta, sólo puede ser un CV (o una
    constancia vieja, que la usa una evidencia o ya no la usa nadie)."""
    return asset.resource_type == "raw" or asset.format == "pdf"


def _public_id_of(url: str | None) -> str | None:
    parsed = cld.parse_cloudinary_url(url or "")
    return parsed.public_id if parsed else None


async def _cv_references(session: AsyncSession) -> Counter[str]:
    """Cuántos perfiles apunta cada `public_id` (el CV protegido o la URL de
    Cloudinary de un CV viejo). Lo que aparece acá nunca se borra."""
    rows = (
        await session.execute(
            select(WorkerProfileModel.cv_public_id, WorkerProfileModel.cv_url).where(
                or_(
                    WorkerProfileModel.cv_public_id.is_not(None),
                    WorkerProfileModel.cv_url.is_not(None),
                )
            )
        )
    ).all()
    counts: Counter[str] = Counter()
    for public_id, url in rows:
        if public_id:
            counts[public_id] += 1
        url_id = _public_id_of(url)
        if url_id is not None:
            counts[url_id] += 1
    return counts


async def _other_uses(session: AsyncSession) -> set[str]:
    """Los `public_id` que usa otra cosa que no es un CV: fotos de perfil,
    logos, portadas y documentos de identidad. Un archivo sin carpeta que
    está acá no se protege ni se borra."""
    used: set[str] = set()
    queries = (
        select(WorkerProfileModel.photo_url),
        select(CompanyProfileModel.logo_url),
        select(CompanyProfileModel.cover_photo_url),
        select(IdentityEvidenceModel.data_url),
    )
    for query in queries:
        for (url,) in (await session.execute(query)).all():
            public_id = _public_id_of(url)
            if public_id is not None:
                used.add(public_id)
    evidence_ids = await session.execute(
        select(IdentityEvidenceModel.file_public_id).where(
            IdentityEvidenceModel.file_public_id.is_not(None)
        )
    )
    used.update(public_id for (public_id,) in evidence_ids.all())
    return used


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

    async def protect_and_point(
        session: AsyncSession, profile_id, asset: Asset, fallback_format: str, still_as_read
    ) -> None:
        if asset.type == PROTECTED:
            report.already_protected += 1
        else:
            out(f"perfil {profile_id}: CV {asset.public_id} ({asset.type}) {verb} a protegido")
            if apply:
                admin.protect(asset)
            report.files_protected += 1
        if apply:
            # Sólo si el perfil sigue como se leyó: un cambio de la persona
            # mientras corre no se pisa.
            result = await session.execute(
                update(WorkerProfileModel)
                .where(WorkerProfileModel.id == profile_id, still_as_read)
                .values(
                    cv_public_id=asset.public_id,
                    cv_resource_type=asset.resource_type,
                    cv_format=asset.format or fallback_format,
                    cv_delivery_type=PROTECTED,
                    cv_url=None,
                )
                .execution_options(synchronize_session=False)
            )
            # Un perfil por commit: si algo se corta, lo hecho queda hecho.
            await session.commit()
            if result.rowcount == 0:
                report.problems.append(
                    f"perfil {profile_id}: cambió mientras corría; no se tocó el perfil"
                )
                return
        report.rows_migrated += 1

    # 1) Perfiles con un CV viejo (URL pública) o un CV que no es `authenticated`.
    async with session_factory() as session:
        references = await _cv_references(session)
        other_uses = await _other_uses(session)
        rows = (
            await session.execute(
                select(
                    WorkerProfileModel.id,
                    WorkerProfileModel.cv_url,
                    WorkerProfileModel.cv_public_id,
                    WorkerProfileModel.cv_resource_type,
                    WorkerProfileModel.cv_format,
                    WorkerProfileModel.cv_delivery_type,
                ).where(
                    or_(
                        WorkerProfileModel.cv_url.is_not(None)
                        & WorkerProfileModel.cv_public_id.is_(None),
                        WorkerProfileModel.cv_public_id.is_not(None)
                        & (WorkerProfileModel.cv_delivery_type != PROTECTED),
                    )
                )
            )
        ).all()
        for profile_id, cv_url, cv_public_id, cv_rt, cv_format, cv_type in rows:
            if cv_public_id:
                asset = admin.find(cv_public_id, cv_rt or "image")
                if asset is None:
                    report.problems.append(
                        f"perfil {profile_id}: {cv_public_id} no está en Cloudinary"
                    )
                    continue
                still_as_read = (WorkerProfileModel.cv_public_id == cv_public_id) & (
                    WorkerProfileModel.cv_delivery_type == cv_type
                )
                await protect_and_point(session, profile_id, asset, cv_format or "", still_as_read)
                continue

            parsed = cld.parse_cloudinary_url(cv_url or "")
            if parsed is None:
                continue  # link pegado a mano: lo controla la persona
            cloud = cld.delivery_url_cloud(cv_url or "")
            if settings.cloudinary_cloud_name and cloud != settings.cloudinary_cloud_name:
                report.problems.append(
                    f"perfil {profile_id}: el CV es de otra cuenta de Cloudinary ({cloud})"
                )
                continue
            if references[parsed.public_id] > 1:
                report.problems.append(
                    f"perfil {profile_id}: {parsed.public_id} lo apuntan "
                    f"{references[parsed.public_id]} perfiles; no se toca"
                )
                continue
            asset = admin.find(parsed.public_id, parsed.resource_type)
            if asset is None:
                report.problems.append(
                    f"perfil {profile_id}: {parsed.public_id} no está en Cloudinary"
                )
                continue
            other = _other_folder(asset)
            if other is not None:
                report.problems.append(
                    f"perfil {profile_id}: {asset.public_id} está en {other}, no parece un CV; "
                    "mirarlo a mano"
                )
                continue
            if _rootless(asset) and asset.public_id in other_uses:
                report.problems.append(
                    f"perfil {profile_id}: {asset.public_id} (sin carpeta) lo usa también una "
                    "foto, un logo, una portada o un documento; no se toca, mirarlo a mano"
                )
                continue
            still_as_read = (WorkerProfileModel.cv_url == cv_url) & (
                WorkerProfileModel.cv_public_id.is_(None)
            )
            await protect_and_point(session, profile_id, asset, parsed.format, still_as_read)

    # 2) Huérfanos: lo que apunta un perfil (antes o después del paso 1: mismo
    #    `public_id`) no se toca.
    async with session_factory() as session:
        referenced = set(await _cv_references(session))
        other_uses = await _other_uses(session)
    delete_verb = "se borra" if apply else "se borraría"
    seen: set[tuple[str, str, str]] = set()

    def delete(asset: Asset, why: str) -> None:
        out(f"archivo {asset.public_id} ({asset.type}): {why}, {delete_verb}")
        if apply:
            try:
                admin.delete(asset)
            except (httpx.HTTPError, cld.CloudinaryDestroyError) as exc:
                report.problems.append(f"archivo {asset.public_id}: no se pudo borrar ({exc})")
                return
        report.orphans_deleted += 1

    def candidates(assets) -> list[Asset]:
        out_list = []
        for asset in assets:
            key = (asset.resource_type, asset.type, asset.public_id)
            if key in seen or asset.public_id in referenced:
                continue
            seen.add(key)
            out_list.append(asset)
        return out_list

    def recent(asset: Asset) -> bool:
        if asset.created_at is None or now - asset.created_at < ORPHAN_MIN_AGE:
            report.recent_skipped += 1
            return True
        return False

    # 2a) La carpeta del CV.
    for resource_type in RESOURCE_TYPES:
        for asset in candidates(admin.list_files(CV_FOLDER, resource_type)):
            if not recent(asset):
                delete(asset, "CV que nadie usa")

    # 2b) Sin carpeta (los CV de antes del 2026-10-15).
    for resource_type in RESOURCE_TYPES:
        for asset in candidates(admin.list_root(resource_type)):
            in_use = asset.public_id in other_uses
            if not _is_document(asset):
                # Una foto: la que usa otra cosa es eso (una foto de perfil o
                # un logo); la que nadie usa puede ser un CV en imagen.
                if not in_use and not recent(asset):
                    fmt = asset.format or "sin formato"
                    report.to_review.append(
                        f"{asset.public_id} ({asset.resource_type}, {fmt}, {asset.type}): "
                        "foto sin carpeta que nada usa; puede ser un CV viejo"
                    )
                continue
            if in_use:
                report.to_review.append(
                    f"{asset.public_id} ({asset.resource_type}, {asset.type}): documento sin "
                    "carpeta que usa otra cosa (una evidencia); no se toca"
                )
                continue
            if not recent(asset):
                delete(asset, "documento sin carpeta que nadie usa (CV viejo)")

    out(summary(report, apply, "perfiles migrados"))
    for problem in report.problems:
        out(f"  ! {problem}")
    for item in report.to_review:
        out(f"  ? {item}")
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
