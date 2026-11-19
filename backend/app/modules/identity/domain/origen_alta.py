"""Origen de un alta: por qué enlace llegó la persona.

Fase 0 del plan de crecimiento (aprobado por Julieta el 2026-11-18): saber
qué canal trae altas. El enlace con el que alguien entra a Oído puede traer
`?ref=` (los que arma Julieta: un grupo de WhatsApp, la bio de Instagram, un
volante) o parámetros `utm_*` (los que agregan solos Instagram, Linktree o
un anuncio). El frontend guarda los del último enlace con origen
(`frontend/lib/origen-alta.ts`) y los manda al crear la cuenta; acá se
reducen a una etiqueta corta, que es lo único que se guarda
(`users.signup_origin`) y lo que agrupa el panel de admin.

- `ref` gana: es el código que pusimos nosotros.
- Si no hay `ref`: `utm_source`, con `utm_campaign` detrás de una barra si
  vino (`ig/fundadores`).
- Sin nada de eso: «directo».

Se normaliza (minúsculas, sin tildes, sólo letras, números, punto, guion y
guion bajo, 40 caracteres por parte) para que «Instagram», « instagram » e
«instagram» cuenten juntos y para que nadie meta texto libre en el panel.
"""

import re
import unicodedata
from dataclasses import dataclass

ORIGEN_DIRECTO = "directo"
LARGO_MAXIMO_PARTE = 40
# Una parte, la barra y otra parte: lo que entra en `users.signup_origin`.
LARGO_MAXIMO_ETIQUETA = 2 * LARGO_MAXIMO_PARTE + 1

_NO_PERMITIDO = re.compile(r"[^a-z0-9._-]+")
_GUIONES = re.compile(r"-{2,}")
_BORDES = "-._"


def normalizar_parte(valor: str | None) -> str | None:
    """Una parte del origen en su forma canónica, o `None` si no queda nada."""
    if not valor:
        return None
    sin_tildes = unicodedata.normalize("NFKD", valor).encode("ascii", "ignore").decode("ascii")
    limpio = _NO_PERMITIDO.sub("-", sin_tildes.strip().lower())
    limpio = _GUIONES.sub("-", limpio).strip(_BORDES)
    limpio = limpio[:LARGO_MAXIMO_PARTE].strip(_BORDES)
    return limpio or None


@dataclass(frozen=True)
class OrigenAlta:
    """Los parámetros del enlace de entrada, tal como llegaron."""

    ref: str | None = None
    utm_source: str | None = None
    utm_campaign: str | None = None

    def etiqueta(self) -> str:
        ref = normalizar_parte(self.ref)
        if ref:
            return ref
        partes = [
            parte
            for parte in (normalizar_parte(self.utm_source), normalizar_parte(self.utm_campaign))
            if parte
        ]
        return "/".join(partes) or ORIGEN_DIRECTO


def origen_de_alta_publica(origen: OrigenAlta | None) -> str:
    """La etiqueta que se guarda en un alta pública (la que acepta términos):
    siempre hay una, «directo» si el enlace no traía nada."""
    return (origen or OrigenAlta()).etiqueta()
