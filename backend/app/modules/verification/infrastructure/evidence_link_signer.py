"""Adaptador de `EvidenceLinkSigner` sobre la API de descarga de Cloudinary
(ADR-0021).

El archivo de una evidencia sube `private`: no hay URL de `res.cloudinary.com`
que lo entregue. El link que ve el admin es `private_download_url` (API de
descarga firmada con `expires_at`), que anda en el plan gratis.
"""

from datetime import datetime

from app.core.cloudinary import private_download_url
from app.modules.verification.domain.repositories import EvidenceLinkSigner
from app.modules.verification.domain.value_objects import EvidenceFile


class CloudinaryEvidenceLinkSigner(EvidenceLinkSigner):
    def link_for(self, file: EvidenceFile, expires_at: datetime) -> str:
        """Tira `CloudinaryNotConfiguredError` si falta la configuración."""
        return private_download_url(
            public_id=file.public_id,
            file_format=file.format,
            resource_type=file.resource_type,
            delivery_type=file.delivery_type,
            expires_at=int(expires_at.timestamp()),
        )
