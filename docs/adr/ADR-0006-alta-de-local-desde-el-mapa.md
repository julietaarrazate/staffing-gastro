# ADR-0006 — Alta de local desde el mapa (geocoder gratis)

**Estado:** aprobado (operadora, 2026-07-13). Extiende ADR-0001 (MapLibre).

## Contexto
El alta del comercio hoy carga la ubicación con selects de provincia/localidad
(`LocationPicker`) — funcional pero con fricción y geolocalización aproximada.
El matching de Staffya es **por cercanía**, así que una ubicación imprecisa
degrada el producto. El mapa (MapLibre) ya existe mostrando turnos/trabajadores.

## Decisión
Onboarding del comercio **desde el mapa**: el comercio **busca su dirección**,
ve un **pin arrastrable** sobre el mapa, lo confirma, y eso fija
`address/city/latitude/longitude` del perfil. Reemplaza al `LocationPicker` en
el alta del comercio (se mantiene como fallback si el geocoder no responde).

- **Geocoder GRATIS**: Nominatim/Photon sobre OpenStreetMap (o el geocoding del
  proveedor de tiles ya en uso). **NO Google Places** — cobra por búsqueda y la
  operadora no quiere costos de API. Respetar el rate-limit y política de uso de
  Nominatim (User-Agent propio, no abusar; debounce en el input).
- **La credencial sigue siendo mail+contraseña** — el mapa es el paso de
  ubicación/alta, no el login. No se mezcla con auth.
- **Pin arrastrable**: si el geocoder erra unos metros, el comercio ajusta a
  mano; la posición final del pin es la fuente de verdad de lat/lng.

## Fuera de alcance (futuro, no ahora)
Pre-cargar POIs gastronómicos de OpenStreetMap para "reclamar tu local" (jugada
Google Business Profile) — es un motor de adquisición, se evalúa después.

## Consecuencias
A favor: menos fricción, geolocalización correcta (mejor matching), se siente
moderno. En contra: dependencia del geocoder gratis (mitigada por el fallback y
el pin manual); rate-limits de Nominatim (mitigados con debounce + uso propio).
