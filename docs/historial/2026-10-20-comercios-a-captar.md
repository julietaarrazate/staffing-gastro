# Comercios a captar en el panel de admin

**Pedido:** Julieta quiso una herramienta para encontrar comercios
gastronómicos y cerrarlos antes de la beta; pensaba en scrapear Google Maps
(como MapiLeads) y pidió revisar si ya había algo parecido. No había.

**Qué cambió:** en el panel de admin hay un botón nuevo, "Comercios a
captar" (`/admin/leads`). Se elige un barrio, se traen sus bares,
restaurantes y cafés desde OpenStreetMap, y cada uno se ve con prioridad,
teléfono, web, Instagram y links a Maps y OSM. Se marca el estado (nuevo,
contactado, visitado, interesado, dado de alta, descartado), se anotan notas
y se exporta a CSV.

Técnico: módulo `backend/app/modules/lead/` (dominio, caso de uso
`LeadService`, adaptador `OverpassPlaceSource`, rutas `/admin/leads`),
migración `0037_create_leads_table.py`, pantalla
`frontend/app/admin/leads/page.tsx` y ayudas en `frontend/lib/leads.ts`.

**Por qué así:** OpenStreetMap en vez de scrapear Maps (términos de servicio
y costo cero), por barrio y con prioridad simple. Detalle en
[ADR-0019](../adr/ADR-0019-comercios-a-captar-desde-openstreetmap.md).

**Queda abierto:** probar la primera importación real en producción (desde
la sesión no hay salida a Overpass); mapa de los comercios y vínculo con el
comercio cuando se da de alta, si hacen falta.
