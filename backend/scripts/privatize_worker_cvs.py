"""Pasa a privados los CV que ya estaban subidos y BORRA los que nadie usa
(ADR-0021, «Actualización 2026-11-19: el CV también»).

Hasta el 2026-11-19 el CV del trabajador (teléfono, email, domicilio) subía a
Cloudinary con entrega pública (`type=upload`) y el perfil guardaba su URL:
quien la vio una vez la seguía abriendo para siempre, y al cambiar o sacar el
CV el archivo viejo no se borraba. Las subidas nuevas ya son privadas y se
ven con un link que vence; este script arregla lo de antes:

1. **Perfiles con un CV viejo** (`worker_profiles.cv_url` con una URL de
   Cloudinary): cambia el archivo a `private` (`rename` de la Upload API, mismo
   `public_id`, `invalidate=true` para sacarlo de la caché del CDN) y guarda en
   el perfil la referencia privada (`cv_*`), vaciando `cv_url`. Desde ahí el
   comercio lo ve sólo con un link que vence. **No toca** (y lo lista en
   problemas, para mirarlo a mano):
   - un archivo de otra carpeta de la app (fotos de perfil, portadas,
     identidad, constancias): un link así no es un CV, y pasarlo a privado
     rompería esa foto;
   - un archivo que apuntan dos perfiles: si uno lo cambia, se le borraría al
     otro;
   - una URL de otra cuenta de Cloudinary.
   Un link pegado a mano (Drive, LinkedIn) no es de Cloudinary: no se toca.
2. **Huérfanos de la carpeta `oido/cv/`** (públicos o privados) que ningún
   perfil apunta: CV que se cambiaron o sacaron antes de este cambio (el
   archivo viejo quedaba) y subidas que nunca se guardaron. Los **borra** con
   `destroy` (`invalidate=true`). Nunca toca lo que apunta un perfil, ni lo
   subido hace menos de 24 h (puede ser de alguien que está guardando su
   perfil).

**Es idempotente:** un perfil ya migrado no se vuelve a tocar, un archivo que
ya es privado sólo actualiza el perfil, y un huérfano borrado ya no aparece.
Si se corta a la mitad, se vuelve a correr.

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
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core import cloudinary as cld
from app.core.config import settings
from app.modules.worker.infrastructure.models import WorkerProfileModel
from scripts.privatize_identity_evidence import (
    ORPHAN_MIN_AGE,
    RESOURCE_TYPES,
    Asset,
    CloudinaryAdmin,
    HttpCloudinaryAdmin,
    Report,
)

PRIVATE = cld.PRIVATE_DELIVERY_TYPE
CV_FOLDER = cld.FOLDERS["cv"]
# Las otras carpetas de la app: un archivo de ahí pegado como CV no es un CV.
OTHER_FOLDERS = tuple(folder for kind, folder in cld.FOLDERS.items() if kind != "cv")


def _other_folder(asset: Asset) -> str | None:
    for folder in OTHER_FOLDERS:
        if asset.folder == folder or asset.public_id.startswith(f"{folder}/"):
            return folder
    return None


async def _references(session: AsyncSession) -> Counter[str]:
    """Cuántos perfiles apunta cada `public_id` (el CV privado o la URL de
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
        parsed = cld.parse_cloudinary_url(url or "")
        if parsed is not None:
            counts[parsed.public_id] += 1
    return counts


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

    # 1) Perfiles que todavía guardan la URL de un CV viejo (público).
    async with session_factory() as session:
        references = await _references(session)
        rows = (
            await session.execute(
                select(WorkerProfileModel).where(
                    WorkerProfileModel.cv_url.is_not(None),
                    WorkerProfileModel.cv_public_id.is_(None),
                )
            )
        ).scalars().all()
        for row in rows:
            parsed = cld.parse_cloudinary_url(row.cv_url or "")
            if parsed is None:
                continue  # link pegado a mano: lo controla la persona
            cloud = cld.delivery_url_cloud(row.cv_url or "")
            if settings.cloudinary_cloud_name and cloud != settings.cloudinary_cloud_name:
                report.problems.append(
                    f"perfil {row.id}: el CV es de otra cuenta de Cloudinary ({cloud})"
                )
                continue
            if references[parsed.public_id] > 1:
                report.problems.append(
                    f"perfil {row.id}: {parsed.public_id} lo apuntan "
                    f"{references[parsed.public_id]} perfiles; no se toca"
                )
                continue
            asset = admin.find(parsed.public_id, parsed.resource_type)
            if asset is None:
                report.problems.append(
                    f"perfil {row.id}: {parsed.public_id} no está en Cloudinary"
                )
                continue
            other = _other_folder(asset)
            if other is not None:
                report.problems.append(
                    f"perfil {row.id}: {asset.public_id} está en {other}, no parece un CV; "
                    "mirarlo a mano"
                )
                continue
            if asset.type == PRIVATE:
                report.already_private += 1
            elif asset.type == "upload":
                out(f"perfil {row.id}: CV {asset.public_id} {verb} a privado")
                if apply:
                    admin.make_private(asset)
                report.files_made_private += 1
            else:
                report.problems.append(
                    f"perfil {row.id}: {asset.public_id} es de tipo {asset.type}; no se toca"
                )
                continue
            if apply:
                row.cv_public_id = asset.public_id
                row.cv_resource_type = asset.resource_type
                row.cv_format = asset.format or parsed.format
                row.cv_delivery_type = PRIVATE
                row.cv_url = None
                # Un perfil por commit: si algo se corta, lo hecho queda hecho.
                await session.commit()
            report.rows_migrated += 1

    # 2) Huérfanos de la carpeta del CV: se borran. Lo que apunta un perfil
    #    (antes o después del paso 1: mismo `public_id`) no se toca.
    async with session_factory() as session:
        referenced = set(await _references(session))
    delete_verb = "se borra" if apply else "se borraría"
    seen: set[tuple[str, str, str]] = set()
    for resource_type in RESOURCE_TYPES:
        for asset in list(admin.list_files(CV_FOLDER, resource_type)):
            key = (asset.resource_type, asset.type, asset.public_id)
            if key in seen or asset.public_id in referenced:
                continue
            seen.add(key)
            if asset.created_at is None or now - asset.created_at < ORPHAN_MIN_AGE:
                report.recent_skipped += 1
                continue
            out(f"archivo {asset.public_id} ({asset.type}): CV que nadie usa, {delete_verb}")
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
        f"[{mode}] perfiles migrados: {report.rows_migrated} · CV a privado: "
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
