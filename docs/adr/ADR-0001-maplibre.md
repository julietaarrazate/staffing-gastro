# ADR-0001 — Migración del sistema de mapas: Leaflet → MapLibre GL JS

**Estado:** aceptado (diseño aprobado en [MAPS_REDESIGN.md](../reference/MAPS_REDESIGN.md), PR #48) ·
**Fecha:** 2026-07-02

## Contexto

La geolocalización es el pilar de Staffya (la distancia pesa 0.30 en el
matching; la meta del producto es cubrir turnos en < 10 minutos). El sistema
anterior (Leaflet + react-leaflet + tiles **raster** CARTO Voyager) tenía un
techo de calidad estructural: zoom discreto, render DOM que degrada con muchos
puntos, sin clustering, sin rotación/pitch, pins como strings de HTML inline y
sin capa de abstracción (cada componente importaba `leaflet` directo).

## Decisión

1. **Motor:** `maplibre-gl` v5 (render vectorial WebGL, open source, sin
   token) con **`@vis.gl/react-maplibre`** como integración React (sucesor
   mantenido de react-map-gl para MapLibre, compatible con React 19).
2. **Estilo:** CARTO **Voyager GL** vectorial
   (`basemaps.cartocdn.com/gl/voyager-gl-style/style.json`), sin API key —
   misma familia visual que los tiles anteriores. Centralizado en
   `frontend/lib/map/style.ts`.
3. **Clustering:** **`supercluster`** en el cliente (índice sobre los turnos
   visibles, `lib/map/clustering.ts`) en lugar del clustering nativo de la
   fuente GeoJSON: permite renderizar los clusters/puntos como **DOM markers
   de React** (animaciones del DS con CSS/motion) manteniendo el conteo y la
   expansión por zoom.
4. **Encapsulamiento:** todo vive en `frontend/components/map/` +
   `frontend/lib/map/`; **ninguna pantalla importa `maplibre-gl` directo**
   (regla espejo del "no acoplar módulos" del backend).
5. **Migración por pantalla** con la misma interfaz de props; Leaflet convive
   hasta F3 (`WorkerSearchMap`, `MiniMap`) y recién entonces se desinstala.

## Consecuencias

- ✅ Zoom continuo, cámara animada (`flyTo`/`easeTo`), clustering y marcadores
  propios con identidad por rubro — la sensación "app de movilidad" del diseño.
- ✅ Base preparada para rutas (F4, puerto `RoutingProvider`) y tiempo real
  (F5) sin re-arquitectura.
- ⚠️ +~190 KB gz de bundle en pantallas con mapa (mitigado: `dynamic import`
  sólo donde hay mapa).
- ⚠️ Requiere WebGL (universal en móvil moderno; fallback = lista, que nunca
  depende del mapa).
- ⚠️ Dependencia del estilo gratuito de CARTO (mismo riesgo que los raster
  anteriores; plan B: MapTiler con key o self-host — nuevo ADR si pasa).
