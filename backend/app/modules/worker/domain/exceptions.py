"""Excepciones del dominio de perfil del trabajador."""


class WorkerError(Exception):
    """Excepción base del módulo worker."""


class WorkerProfileAlreadyExistsError(WorkerError):
    """El usuario ya tiene un perfil de trabajador."""


class WorkerProfileNotFoundError(WorkerError):
    """No se encontró el perfil de trabajador solicitado."""


class CvNotFoundError(WorkerError):
    """El perfil no tiene CV (o quien pregunta no lo puede ver: se responde
    igual, para no revelar qué existe)."""


class CvFileNotAcceptedError(WorkerError):
    """El archivo que se quiere poner como CV no lo subió esta cuenta con la
    firma del CV, o es un link público de un archivo de Cloudinary (ADR-0021,
    actualización 2026-11-19)."""


class CvFileReleasedError(WorkerError):
    """El CV que se quiere poner ya se mandó a borrar: la persona lo cambió o
    lo sacó desde otro lado y este pedido viene de un formulario abierto
    desde antes."""
