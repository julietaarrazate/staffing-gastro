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

## Actualización 2026-11-19: el mapa chico ya no usa MapLibre

El paso 4 del plan (`docs/reference/MAPS_REDESIGN.md` §8) dejaba abierto que
`MiniMap` pasara «a imagen estática del estilo si el peso no justifica canvas
por thumbnail». Lo justificaba: cada tarjeta de Mis turnos bajaba el motor
entero (~1 MB de JS) y abría su propio WebGL para una foto de 112 px que no
se toca, y la pantalla pesaba el doble que las demás. Ahora `MiniMap` dibuja
en SVG calles, avenidas, plazas y agua a partir de los **mismos mosaicos
vectoriales de CARTO** (`lib/map/mapa-chico.ts`), con los colores de un mapa
de siempre (elegidos por Julieta). MapLibre sigue para todo mapa que se
mueve y para el de «va en camino» (`EnRouteMap`). Medido en
`docs/reference/RENDIMIENTO.md` (Mis turnos: 634 → 343 KB de JS, TBT 827 →
290 ms).

El riesgo de arriba ya se cumplió en parte: **los mosaicos-imagen de CARTO
ahora piden clave** («API KEY REQUIRED», visto el 2026-11-19). Los
vectoriales, que usan el mapa grande y el chico, siguen libres; si también
la piden, rige el plan B de arriba (y un ADR nuevo).

