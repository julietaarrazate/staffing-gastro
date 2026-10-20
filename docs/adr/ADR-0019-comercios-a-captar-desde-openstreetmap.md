# ADR-0019 — Comercios a captar: lista desde OpenStreetMap, no scraping de Google Maps

**Estado:** aceptado · **Fecha:** 2026-10-20

## Contexto

Antes de abrir la beta hay que sumar comercios gastronómicos, empezando por
Palermo. Julieta propuso una herramienta que scrapee Google Maps para armar
una lista de contactos (nombre, dirección, teléfono, mail). Existen servicios
pagos que hacen eso (MapiLeads, desde €16,95/mes; MapsLeads, por contacto);
Oído no tiene presupuesto para sumar otro.

## Decisión

1. **Fuente: OpenStreetMap vía la API pública de Overpass**, no Google Maps.
   Scrapear Maps va contra sus términos; los datos de OSM tienen licencia
   abierta (ODbL), que sólo pide atribución. Es menos completo que Maps, pero
   alcanza para armar la lista de un barrio. Para ver fotos y reseñas, cada
   comercio tiene un **link** a Maps (abrir un link no es scraping).
2. **Por barrio de la Ciudad, de una lista cerrada** (los 48), no por un
   rectángulo libre: la densidad en un barrio vale más que la cobertura
   amplia, y una lista cerrada evita consultas enormes a un servicio
   comunitario. La consulta busca el barrio como límite administrativo
   (`admin_level=10`) dentro de la Ciudad, para no confundir "Palermo" con la
   ciudad de Italia.
3. **Módulo propio `lead`** con sus capas (dominio sin frameworks, puerto
   `PlaceSource` con el adaptador `OverpassPlaceSource`, tabla `leads`,
   migración `0037`). Pantalla `/admin/leads`, sólo admin.
4. **Volver a importar es idempotente:** `osm_ref` ("node/123") es único; los
   datos del comercio se refrescan y el seguimiento (estado, notas, fecha de
   contacto) nunca se pisa.
5. **Prioridad simple y explicable (0 a 5):** rubro (restaurante y bar 3,
   café 2, resto 1) + 1 si hay teléfono o email + 1 si hay web o Instagram. Se
   calcula en el dominio; el listado ordena por prioridad y después por nombre.
6. **Exportar a CSV** desde la pantalla, con las celdas que empiezan con
   `= + - @` neutralizadas (inyección de fórmulas en Excel).

## Por qué

- Costo cero y sin riesgo de términos de servicio.
- Encaja con la estrategia de densidad por barrio.
- El puerto `PlaceSource` deja cambiar la fuente (por ejemplo, la API oficial
  de Google Places con su cupo gratis) sin tocar el dominio.

## Datos personales

Son datos de comercios, publicados en un mapa abierto, y sólo los ve la
admin. Igual, un comercio de una persona humana puede tener datos personales
(Ley 25.326): se usan para contactar uno a uno, no para mandar publicidad
masiva, y llamar o escribir con fines comerciales tiene que respetar el
Registro "No Llame" (Ley 26.951). La pantalla lo recuerda junto a la
atribución de OSM. No cambia `/privacidad`: no son usuarios de la app.

## Fuera de alcance

- Mapa de los comercios (hoy es lista; los links abren Maps y OSM).
- Enriquecer con Google Places API o con las webs de cada comercio.
- Vincular un lead con el `company_profile` cuando se da de alta.

## Consecuencias

- ⚠️ La consulta real a Overpass no se pudo probar desde la sesión en la nube
  (sin salida a ese host); los tests cubren la consulta armada y el parseo de
  una respuesta real de ejemplo. Primera importación en producción: revisar
  que Palermo devuelva comercios.
- ⚠️ **Primera importación real (2026-10-20): falló.** Desde Render,
  `overpass-api.de` no aceptó la conexión ("All connection attempts
  failed"). Se agregaron servidores públicos de respaldo de Overpass que se
  prueban en orden si uno no conecta, está limitado (429) o falla (5xx);
  un 4xx (consulta mal armada) no se reintenta. Ver
  `historial/2026-10-20-overpass-respaldo.md`.
- ✅ Tests: `backend/tests/test_lead.py`, `frontend/lib/leads.test.ts`,
  `frontend/e2e/admin-leads.spec.ts`.
