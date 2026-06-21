"""Objetos de valor del dominio de perfil del comercio."""

from enum import Enum


class CompanyCategory(str, Enum):
    """Rubro del comercio / organizador, según el spec de Staffya."""

    RESTAURANTE = "restaurante"
    BAR = "bar"
    CAFETERIA = "cafeteria"
    SALON_EVENTOS = "salon_eventos"
    CATERING = "catering"
    EMPRESA_GASTRONOMICA = "empresa_gastronomica"
