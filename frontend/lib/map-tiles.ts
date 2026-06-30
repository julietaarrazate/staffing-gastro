/**
 * Tiles de mapa con estilo (look de app tipo Uber/Uber Eats), no los tiles
 * crudos de OpenStreetMap. Usamos CARTO Voyager: calles suaves, etiquetas
 * limpias, sin API key. Atribución requerida por OSM + CARTO.
 */
export const MAP_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const MAP_TILE_SUBDOMAINS = "abcd";
