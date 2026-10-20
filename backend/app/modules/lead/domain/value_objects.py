"""Value objects del módulo lead (comercios a captar para la beta)."""

from enum import Enum


class LeadStatus(str, Enum):
    """En qué punto está el contacto con el comercio.

    Lo mueve a mano quien sale a captar (admin): no hay transiciones
    automáticas, salvo que importar de nuevo un barrio nunca pisa el estado.
    """

    NUEVO = "nuevo"
    CONTACTADO = "contactado"
    VISITADO = "visitado"
    INTERESADO = "interesado"
    ALTA = "alta"
    DESCARTADO = "descartado"


class LeadKind(str, Enum):
    """Rubro del comercio, traducido del tag `amenity` de OpenStreetMap."""

    RESTAURANTE = "restaurante"
    BAR = "bar"
    CAFE = "cafe"
    COMIDA_RAPIDA = "comida_rapida"
    HELADERIA = "heladeria"


# `amenity` de OSM → rubro. Lo que no está acá no se importa.
OSM_AMENITY_TO_KIND: dict[str, LeadKind] = {
    "restaurant": LeadKind.RESTAURANTE,
    "bar": LeadKind.BAR,
    "pub": LeadKind.BAR,
    "cafe": LeadKind.CAFE,
    "fast_food": LeadKind.COMIDA_RAPIDA,
    "ice_cream": LeadKind.HELADERIA,
}

# Los 48 barrios de la Ciudad de Buenos Aires. Se importa por barrio y no por
# un rectángulo libre a propósito: la densidad en un barrio importa más que la
# cobertura amplia (ADR-0009, contexto), y una lista cerrada evita consultas
# gigantes contra el servicio público de OpenStreetMap.
BARRIOS_CABA: tuple[str, ...] = (
    "Agronomía", "Almagro", "Balvanera", "Barracas", "Belgrano", "Boedo",
    "Caballito", "Chacarita", "Coghlan", "Colegiales", "Constitución", "Flores",
    "Floresta", "La Boca", "La Paternal", "Liniers", "Mataderos", "Monte Castro",
    "Montserrat", "Nueva Pompeya", "Núñez", "Palermo", "Parque Avellaneda",
    "Parque Chacabuco", "Parque Chas", "Parque Patricios", "Puerto Madero",
    "Recoleta", "Retiro", "Saavedra", "San Cristóbal", "San Nicolás",
    "San Telmo", "Vélez Sarsfield", "Versalles", "Villa Crespo",
    "Villa del Parque", "Villa Devoto", "Villa General Mitre", "Villa Lugano",
    "Villa Luro", "Villa Ortúzar", "Villa Pueyrredón", "Villa Real",
    "Villa Riachuelo", "Villa Santa Rita", "Villa Soldati", "Villa Urquiza",
)
