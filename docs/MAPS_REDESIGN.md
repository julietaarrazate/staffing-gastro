# MAPS_REDESIGN.md — Rediseño del sistema de mapas y geolocalización

> **Estado: PROPUESTA — pendiente de aprobación.** Nada de esto está
> implementado; la implementación arranca sólo después de aprobar este diseño.
> Complementa [LOCATION.md](./LOCATION.md) (dominio) y
> [ARCHITECTURE.md](./ARCHITECTURE.md) (frontend). La decisión de migrar de
> librería, al aprobarse, se registra como **ADR-0001**.

**Objetivo:** que la geolocalización de Staffya se sienta al nivel de
Uber/Rappi/Apple Maps — mapa vectorial fluido, marcadores propios con identidad
por rubro, clustering, sincronización mapa↔tarjetas y arquitectura lista para
rutas y tiempo real — manteniendo base **open source** y sin Google Maps.

---

## 1. Auditoría del sistema actual (Leaflet)

### Inventario real

| Pieza | Archivo | Qué hace hoy |
|-------|---------|--------------|
| `ShiftMap` | `components/worker/ShiftMap.tsx` | Mapa del worker (`/map`): pins de turnos, pin de origen, `panTo` animado a la tarjeta activa, click en pin → selecciona tarjeta. |
| `WorkerSearchMap` | `components/WorkerSearchMap.tsx` | Mapa del comercio (`/search`): pins de trabajadores con **Popup default de Leaflet** (look técnico). |
| `MiniMap` | `components/MiniMap.tsx` | Thumbnail estático no interactivo en detalle de turno (`ShiftCard`). |
| Tiles | `lib/map-tiles.ts` | **CARTO Voyager raster** (PNG), `detectRetina`, sin API key. |
| Geo | `lib/geolocation.ts` | `getCurrentPosition` (one-shot). |
| Distancia | `app/map/page.tsx` (`haversineKm`) + `backend app/core/geo.py` | Haversine duplicado cliente/servidor. |
| UX `/map` | `app/map/page.tsx` | Mapa **full-screen** + carrusel horizontal flotante abajo (86% de ancho por tarjeta, snap). Sincronización básica ya existe (scroll→pan, pin→scroll). |

### Diagnóstico

**Lo que ya está bien** (se conserva como semántica): tiles con estilo de app
(no OSM crudo), pins propios (no los markers azules default), sincronización
tarjeta↔mapa bidireccional, geolocalización con fallback (Obelisco), carga del
feed filtrando postulados.

**Limitaciones estructurales de la base actual:**

1. **Raster, no vectorial.** Los tiles PNG se ven "cargando por cuadraditos",
   el zoom es a saltos discretos, sin rotación/pitch, sin transiciones de
   etiquetas. Es el techo de calidad percibida: nunca va a sentirse como Uber.
2. **Render DOM, no GPU.** Leaflet mueve nodos DOM por marcador; con cientos de
   puntos degrada. Sin clustering (no hay plugin instalado).
3. **Pins como strings de HTML inline** (`L.divIcon({html: '<div style=...'})`)
   duplicados en 3 archivos, con estilos fuera del Design System, sin
   animaciones de aparición/selección, sin identidad por rubro.
4. **Popup default de Leaflet** en `/search`: look técnico, tipografía ajena al
   DS.
5. **Sin capa de abstracción**: cada componente importa `leaflet` directo; un
   cambio de librería toca todo.
6. **Sin rutas ni tiempos**: sólo distancia en línea recta; no hay "cómo
   llegar" ni tiempos estimados por modo.
7. **Geolocalización one-shot**: no hay `watchPosition`, geofencing ni
   actualización continua (el check-in geolocalizado del backend ya existe,
   pero el front no acompaña con posición viva).
8. **`haversineKm` duplicado** en el cliente (deuda menor, se resuelve de paso).

## 2. Comparación técnica: Leaflet vs MapLibre GL JS

| Criterio | Leaflet (+react-leaflet) | MapLibre GL JS |
|----------|--------------------------|----------------|
| Render | DOM + tiles **raster** | **WebGL/GPU, tiles vectoriales** |
| Zoom | discreto, por niveles | **continuo y fluido** (fractional zoom) |
| Rotación / pitch | no (plugins frágiles) | **nativo** (gestos de dos dedos) |
| Estilo del mapa | el del PNG que sirva el proveedor | **style spec JSON**: colores, capas y tipografía controlables al detalle |
| Clustering | plugin (markercluster, DOM) | **nativo en la fuente GeoJSON** (supercluster embebido) |
| Animación de cámara | `panTo/flyTo` básicos | `flyTo/easeTo` con curvas, esencial para el "feel" Uber |
| Rendimiento con miles de puntos | degrada (DOM) | **diseñado para eso** (capas GPU) |
| Rutas (línea sobre el mapa) | polyline DOM | **capa de línea GPU** con animación |
| Licencia / lock-in | BSD, open | **BSD, open** (fork comunitario de Mapbox GL v1; sin token Mapbox) |
| Peso | ~42 KB gz + react-leaflet | ~230 KB gz + wrapper (~8 KB) |
| Integración React | react-leaflet v5 (ya en uso) | **@vis.gl/react-maplibre** (sucesor mantenido de react-map-gl para MapLibre; declarativo, React 18/19) |
| Madurez | 15 años, estable | base Mapbox GL (10+ años) + comunidad MapLibre activa (v4/v5) |

**Costo de MapLibre:** ~190 KB gz extra de bundle y requiere WebGL (disponible
en todo móvil moderno; ver riesgos §9).

## 3. Justificación de la migración

1. **El techo de calidad es la librería, no el estilo.** Ya usamos el mejor
   raster gratuito (Voyager); la sensación "app de movilidad" (zoom continuo,
   cámara animada, marcadores que escalan, clustering fluido) exige render
   vectorial GPU. No hay ajuste incremental de Leaflet que lo logre.
2. **La geolocalización es el pilar del producto** (meta: cubrir en < 10 min;
   la distancia pesa 0.30 en el matching — ver [MATCHING.md](./MATCHING.md)).
   Merece infraestructura de primera clase, no un componente agregado.
3. **Escala.** Cientos/miles de puntos visibles con clustering nativo y capas
   GPU, sin cambiar arquitectura después.
4. **Futuro sin re-arquitectura:** rutas ("cómo llegar"), tracking en vivo,
   geofencing y heatmaps son capas naturales de MapLibre; en Leaflet serían
   plugins frágiles.
5. **Open source real:** MapLibre + OSM + estilos CARTO gratuitos: sin Google,
   sin token de Mapbox, sin lock-in.

## 4. Arquitectura propuesta

### Módulo de mapa único (`frontend/components/map/`)

Toda la funcionalidad de mapa vive en un módulo con **API propia**; ninguna
pantalla importa `maplibre-gl` directamente (la regla espejo de "no acoplar
módulos" del backend):

```
frontend/
├── components/map/
│   ├── MapView.tsx          # base: estilo, cámara, atribución, tema
│   ├── ShiftMarker.tsx      # marcador Staffya por rubro (DOM marker animado)
│   ├── WorkerMarker.tsx     # marcador de trabajador (avatar + rating)
│   ├── ClusterMarker.tsx    # burbuja de cluster con conteo
│   ├── UserPuck.tsx         # punto azul del usuario con halo pulsante
│   ├── RadiusRing.tsx       # anillo del radio de búsqueda (capa fill/line)
│   ├── RouteLayer.tsx       # línea de ruta (preparada, se activa en F4)
│   └── MiniMap.tsx          # reemplazo del thumbnail estático
├── lib/map/
│   ├── style.ts             # URL del estilo vectorial + overrides de marca
│   ├── camera.ts            # helpers flyTo/easeTo/fitBounds con curvas
│   ├── clustering.ts        # config de cluster de la fuente GeoJSON
│   ├── geo.ts               # haversine, bearing, bbox (único lugar)
│   ├── travel-time.ts       # tiempos estimados por modo (ver §4.3)
│   └── routing.ts           # PUERTO de rutas (interfaz + providers, F4)
└── lib/geolocation.ts       # se amplía: watchPosition + permisos (§4.4)
```

- **Stack:** `maplibre-gl` v5 + `@vis.gl/react-maplibre` (declarativo,
  mantenido, React 19). `MiniMap`/`ShiftMap`/`WorkerSearchMap` actuales
  conservan **la misma interfaz de props** durante la migración (ver §8).
- **Estilo:** CARTO **Voyager GL** vectorial
  (`https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json`) — misma
  familia visual que hoy pero vectorial, gratuito y sin key. Variante
  **Positron** (más blanca, casi Apple Maps) como alternativa a decidir con el
  mockup. Overrides de marca en `style.ts` (agua/parques más suaves, tipografía
  del sistema).
- **Marcadores:** DOM markers de React (animables con `motion`, ya en el
  stack) para los puntos visibles tras clustering — nunca más de ~40–60 en
  pantalla, así el DOM no es cuello de botella. Identidad por rubro reusando
  `SKILL_ACCENT` + íconos Lucide (nada de emojis: coherencia con el DS).
- **Clustering nativo** de la fuente GeoJSON (`cluster: true`,
  `clusterRadius≈52`), burbujas con conteo; tap → `easeTo` al zoom de
  expansión del cluster (idéntico a Uber).

### 4.2 Estado y sincronización mapa↔tarjetas

Un hook `useMapSync` centraliza la relación:

```
carrusel scroll → activeId → flyTo(marker) + marker.scale↑ + halo
tap en marker  → activeId → carrusel scrollTo(card) + card resaltada
tap en cluster → easeTo(zoom de expansión)
```

Es formalizar lo que `/map` ya hace, con animaciones de cámara reales
(`flyTo` con curva) y estado de selección en el marcador (escala + halo).

### 4.3 Información geográfica por turno

- **Distancia:** Haversine (un solo helper en `lib/map/geo.ts`; muere el
  duplicado de `app/map/page.tsx`).
- **Tiempos estimados** (F3, heurística urbana honesta — se etiqueta "aprox."):
  caminando 4.5 km/h · bici 12 km/h · auto 18 km/h (CABA) sobre distancia
  Haversine × 1.3 (factor de red vial). Sin backend nuevo.
- **Barrio/zona:** ya viene del turno (`city`); la dirección aproximada, del
  perfil del comercio.
- Cuando exista routing real (F4), los tiempos pasan a venir de la ruta y el
  factor 1.3 se retira.

### 4.4 Geolocalización viva y geofencing (preparación)

`lib/geolocation.ts` se amplía con `watchPosition` (suscripción con cleanup,
throttle y filtro de precisión). Sobre eso:

- **Check-in/out por proximidad:** el backend ya valida coordenadas; el front
  podrá habilitar el botón de check-in sólo dentro del radio (geofence
  cliente) y avisar "llegaste a la zona del turno".
- **Turnos nuevos cerca:** al recibir una notificación (WebSocket ya
  existente), si el turno está dentro del radio del usuario, resaltar el
  marcador entrante con animación de aparición.
- El **tracking continuo** (compartir posición en vivo con el comercio) es
  fase futura y requiere decisión de producto + privacidad (ADR).

### 4.5 Rutas — puerto preparado (sin implementar hasta F4)

```ts
// lib/map/routing.ts
export interface RoutingProvider {
  getRoute(origin: LngLat, dest: LngLat, mode: "walking" | "cycling" | "driving"):
    Promise<{ geometry: GeoJSON.LineString; distanceM: number; durationS: number }>;
}
```

- **F3:** botón **"CÓMO LLEGAR"** con deep-link a la app de mapas del teléfono
  (`geo:`/Apple Maps/Google Maps) — valor inmediato, costo cero.
- **F4:** provider **OSRM** (demo server para validar → self-host o Valhalla
  si el volumen lo pide, con ADR) dibujando la ruta en `RouteLayer` con
  animación de trazo. Las pantallas no cambian: sólo se enchufa el provider.

### 4.6 Rendimiento

- Render GPU (MapLibre) + clustering ⇒ fluido con miles de puntos.
- DOM markers sólo para lo visible post-cluster; `React.memo` por marcador;
  `activeId` fuera del estado del mapa (no re-render del canvas).
- Carga progresiva por viewport: el feed actual alcanza para CABA; cuando haya
  multi-ciudad, endpoint con **bbox** (`GET /shifts/feed?bbox=`) — preparado en
  la interfaz del módulo, sin cambio de arquitectura.
- `MapView` con `dynamic(..., { ssr: false })` y **un solo** contexto WebGL
  reutilizado entre vistas; CSS de maplibre importado una vez.
- `prefers-reduced-motion` respeta y desactiva animaciones de cámara.

## 5. Diseño de la nueva experiencia

### Apertura (worker, `/map`)

1. Mapa vectorial aparece con fade; cámara en CABA (Obelisco) como base.
2. Se detecta ubicación → **`flyTo` suave** (1.4 s, curva) al usuario.
3. Aparece el **puck** azul con halo pulsante y el **anillo de radio** (2 km)
   con animación de expansión.
4. Los turnos cercanos entran con **stagger** (marcadores que hacen scale-in
   80 ms uno tras otro, del más cercano al más lejano).
5. El carrusel de tarjetas sube desde abajo (spring suave).

### Layout (40/60)

El mapa deja de ser full-screen con tarjetas flotantes: pasa a **~40% superior
mapa / ~60% inferior tarjetas** (proporción exacta a validar en el mockup), con
el sheet de tarjetas **arrastrable** a tres alturas (picoteo 25% / mitad 60% /
lista completa 90%), estilo Uber Eats/Airbnb. El usuario nunca pierde contexto:
mapa y lista viven juntos.

### Marcadores Staffya

- **Turno:** pastilla redonda blanca (36 px) con el ícono Lucide del rubro en
  su acento `SKILL_ACCENT` (mozo naranja, bartender rosa, barista ámbar…),
  borde blanco 2 px, sombra suave. **Seleccionado:** escala 1.25×, halo naranja
  expandiéndose, y "pico" inferior tipo gota.
- **Urgente:** puntito rojo pulsante en la esquina del marcador.
- **Cluster:** burbuja blanca con conteo en ink y aro naranja; al tocar,
  zoom-expansión.
- **Trabajador** (mapa del comercio): avatar circular con mini-badge de
  rating; seleccionado = escala + tarjeta.
- **Aparición:** scale-in desde 0 con spring; **salida:** fade-out.

### Tarjetas (inspiración Uber Eats / Airbnb)

Tarjeta grande con: foto del comercio (ya existe photo-first), logo, rubro con
chip de acento, **pago prominente**, distancia + **tiempo estimado por modo**
(🚶 12 min · 🚴 5 min · 🚗 4 min), horario del turno, rating del comercio,
compatibilidad (si el skill matchea el perfil) y botón principal
**"Me interesa"**. En detalle: **"CÓMO LLEGAR"**.

## 6. Wireframes

```
WORKER /map (sheet a media altura)          Sheet arriba (lista)
┌─────────────────────────┐                ┌─────────────────────────┐
│  ⌕ 8 turnos cerca   ◎  │ ← chip + geo   │  ⌕ 8 turnos cerca       │
│      🍸    ⑤            │ ← cluster      │ ═══════════════════════ │
│   ☕    ●←puck          │                │ ┌─────────────────────┐ │
│  ⭕radio  🍔(sel,halo)  │   40%          │ │ [foto] Bar Palermo  │ │
│      🍔                 │                │ │ Mozo · $28.000      │ │
│ ═══════════════════════ │ ← handle       │ │ 🚶12' 🚴5' · ★4.8   │ │
│ ┌─────────────────────┐ │                │ │ [ Me interesa ]     │ │
│ │ [foto] Bar Palermo  │ │                │ └─────────────────────┘ │
│ │ 🍸 Bartender $30.000│ │   60%          │ ┌─────────────────────┐ │
│ │ 0.8km 🚶10' · ★4.8  │ │                │ │ [foto] Café Colón   │ │
│ │ [ Me interesa ]     │ │                │ │ ...                 │ │
│ └─────────────────────┘ │                └─────────────────────────┘
│ (swipe ←→ sincroniza    │
│  el mapa)               │
└─────────────────────────┘

EMPLOYER /search                            Detalle de turno
┌─────────────────────────┐                ┌─────────────────────────┐
│ [rol ▾] [radio ▾] 🔍   │                │ [foto hero del comercio]│
│                         │                │ Mozo · Bar Palermo      │
│   👤4.9   ③            │                │ $28.000 · sáb 20-24h    │
│      👤4.7(sel)         │                │ ┌─────────────────────┐ │
│  ●búsqueda  👤4.5       │                │ │ [minimapa vectorial]│ │
│ ═══════════════════════ │                │ │  🍔  · Palermo 0.8km│ │
│ ┌─────────────────────┐ │                │ └─────────────────────┘ │
│ │ (avatar) Juan M.    │ │                │ 🚶12' · 🚴5' · 🚗4'    │
│ │ Mozo · ★4.7 · 0.5km │ │                │ [ CÓMO LLEGAR ]        │
│ │ [ Ver perfil ]      │ │                │ [ Me interesa ]        │
│ └─────────────────────┘ │                └─────────────────────────┘
└─────────────────────────┘
```

## 7. Mockups

Mockup interactivo navegable: **`docs/mockups/maps-redesign-mockup.html`**
(autocontenido, sin dependencias — abrilo en el navegador). Muestra: layout
40/60 con sheet a tres alturas, marcadores por rubro con halo/selección,
cluster, puck con pulso, anillo de radio, sincronización carrusel↔mapa y la
tarjeta con tiempos por modo. El fondo de mapa es un dibujo estilizado (no
tiles reales): valida **layout, marcadores y motion**, no el basemap; el estilo
vectorial real (Voyager GL vs Positron) se decide en la F1 con un spike sobre
datos reales.

## 8. Plan de migración sin romper funcionalidades

Regla: **misma interfaz de props, adentro cambia el motor.** Cada paso es un PR
mergeable con la app funcionando.

| Paso | Qué | Riesgo |
|------|-----|--------|
| 0 | ADR-0001 (Leaflet→MapLibre) + deps (`maplibre-gl`, `@vis.gl/react-maplibre`) — conviven con Leaflet | nulo |
| 1 | `MapView` + estilo vectorial + `UserPuck` + `RadiusRing` detrás del módulo `components/map/` | bajo |
| 2 | **`/map` (worker)** migra: `ShiftMap` reimplementado sobre `MapView` con mismos props (`shifts/center/activeId/onSelect`) + marcadores nuevos + clustering + sheet 40/60 | medio (pantalla más usada — QA en preview de Vercel) |
| 3 | **`/search` (comercio)** migra: `WorkerSearchMap` sobre `MapView`; popups de Leaflet → tarjetas del DS | bajo |
| 4 | **`MiniMap`** migra (o pasa a imagen estática del estilo si el peso no justifica canvas por thumbnail) | nulo |
| 5 | `npm uninstall leaflet react-leaflet` + borrar `lib/map-tiles.ts` — **cero referencias** | nulo |

Verificación por paso: `tsc` + `build` + Playwright móvil (390×844) sobre las
tres pantallas; el paso 5 sólo cuando `grep leaflet` dé vacío.

## 9. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| **Bundle +~190 KB gz** | carga inicial | `dynamic import` sólo en pantallas con mapa (ya es así); code-split del módulo map |
| **WebGL no disponible** (dispositivo viejo/webview capada) | mapa en blanco | detección al montar → fallback a imagen estática del área + lista completa (la lista nunca depende del mapa) |
| **Límites de uso del estilo CARTO gratuito** | corte del basemap | mismo riesgo que hoy con los raster; plan B documentado: MapTiler free tier (key) o self-host de tiles OSM (ADR) |
| **`@vis.gl/react-maplibre` + React 19/Next 16** | fricción de integración | spike en F1 (paso 1) antes de comprometer las pantallas; plan B: usar `maplibre-gl` directo en `MapView` (el módulo lo encapsula igual) |
| **Regresión de UX en `/map`** | pantalla principal del worker | migración por pantalla con preview de Vercel + QA Playwright antes de merge |
| **Permisos de ubicación denegados** | sin geo | ya resuelto (fallback Obelisco); se agrega estado visual "activá tu ubicación" con CTA |
| **Sensación "beta" de tiempos estimados** | confianza | etiquetar "aprox." hasta routing real (F4) |

## 10. Roadmap por fases

| Fase | Alcance | Criterio de cierre |
|------|---------|--------------------|
| **F1 — Base vectorial** | deps + ADR + `MapView`/estilo/puck/anillo + spike de integración | mapa vectorial renderizando en una ruta de prueba, gates verdes |
| **F2 — Worker premium** | `/map` migrado: marcadores por rubro, clustering, sheet 40/60, sync carrusel↔mapa, animaciones de cámara y aparición | `/map` en producción sobre MapLibre, sin regresiones |
| **F3 — Geo-info + comercio** | `/search` migrado, tarjetas DS en vez de popups; tiempos por modo en tarjetas; "CÓMO LLEGAR" (deep-link); `MiniMap` | Leaflet desinstalado (paso 5) |
| **F4 — Rutas in-app** | provider OSRM + `RouteLayer` animada + tiempos reales | ruta dibujada en detalle de turno |
| **F5 — Tiempo real** | `watchPosition`, geofence de check-in/out, resaltado de turnos nuevos cercanos vía WebSocket | check-in asistido por proximidad |

F1–F3 son la migración (reemplazan todo lo existente). F4–F5 son crecimiento
sobre la misma base, sin re-arquitectura.

---

> **Próximo paso:** revisar este documento + el mockup. Con el OK: ADR-0001 y
> arranque de F1.
