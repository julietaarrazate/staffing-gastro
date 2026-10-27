"""Adaptador de `EvidenceFileStorage` sobre Cloudinary (ADR-0021, «Borrado
al decidir»).

Borra con `destroy` de la Upload API (firmado, `invalidate=true`). "not
found" cuenta como borrado; cualquier otra cosa lanza y el pedido queda en
la cola para reintentar.
"""

import httpx

from app.core.cloudinary import check_destroy_result, destroy_request
from app.modules.verification.domain.repositories import EvidenceFileStorage
from app.modules.verification.domain.value_objects import EvidenceFile

_TIMEOUT_SECONDS = 15.0


class CloudinaryEvidenceFileStorage(EvidenceFileStorage):
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        # Los tests pasan un cliente con `MockTransport`; en producción, uno
        # por borrado (son pocos: tres archivos por decisión como mucho).
        self._client = client

    async def delete(self, file: EvidenceFile) -> None:
        """Tira `CloudinaryNotConfiguredError` si falta la configuración,
        `httpx.HTTPError` si Cloudinary no responde o responde un error, y
        `CloudinaryDestroyError` si responde sin borrar."""
        url, params = destroy_request(file.public_id, file.resource_type, file.delivery_type)
        if self._client is not None:
            response = await self._client.post(url, data=params)
        else:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.post(url, data=params)
        response.raise_for_status()
        check_destroy_result(response.json())
