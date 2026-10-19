"""Chequeo de `Origin` para endpoints que usan la cookie httpOnly de refresh.

La cookie va con SameSite=None, así que un sitio ajeno podría disparar un
POST desde el navegador de la víctima. Los navegadores mandan `Origin` en
esos POST: si viene y no es uno de los orígenes permitidos (CORS), se
rechaza. Sin `Origin` (clientes que no son navegador) se deja pasar: no
pueden usar la cookie de otra persona.
"""

from fastapi import HTTPException, Request, status

from app.core.config import settings


async def require_allowed_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin is None:
        return
    if origin.rstrip("/") not in settings.cors_origins_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Origen no permitido")
