# Arreglos chicos: baja neutra, Buscar con «Ver más», Candidatos sin foto, toast de error, ShiftCard

**Pedido:** Julieta (tanda del 2026-11-22), seis detalles de pantalla.

**Qué cambió:**
- **Mi plan** (`frontend/app/subscription/page.tsx`): «Sí, dar de baja» pasa de ámbar a `surface` (blanco con filete; dentro de la hoja, el «quieto» de `.boton-secundario`). «Volver» pasa a `ghost` para que no queden dos iguales. Textos y precios, sin tocar.
- **Buscar del comercio** (`frontend/app/search/page.tsx`): el front no mandaba `limit`, así que valía el default del backend (50, máximo 100, con `offset` ya soportado en `GET /matching/search`). Ahora pide páginas de 50 explícitas; si la página vino llena la API no dice cuántos hay, así que el título dice «50 o más personas…» y aparece «Ver más personas», que pide el `offset` siguiente y suma sin repetir. Al venir una página corta el título vuelve al total exacto. Backend sin cambios.
- **Candidatos** (`frontend/components/candidate/CandidatoDestacado.tsx`): la tarjeta destacada sin foto usa `SinFoto` (el cielo con la inicial) en el círculo, en vez del círculo blanco con iniciales.
- **Toast de error** (`frontend/components/ui/Toast.tsx`): ya no es `text-white` sobre rojo. Usa la píldora del sistema (`bg-toast text-toast-ink`, contraste alto en claro y oscuro) con filete `ring-danger` e ícono de alerta en `danger`. Se descartó `on-brand` sobre `danger-strong`: en claro `on-brand` es tinta (#111) y da ~3,2.
- **ShiftCard** (`frontend/components/ShiftCard.tsx`): el banner sin foto usaba `SKILL_HERO_TONE` (espresso, terracota, oliva…, la estética vieja). Ahora usa `PortadaCielo` con tinta `portada-tinta`, igual que `OpportunityCard`. `SKILL_HERO_TONE` queda en `lib/skill-style.tsx` sin uso en ShiftCard.
- **/admin/metricas** a 360 px y letra al 200 %: se verificó y no desborda; se agregó un test propio en `frontend/e2e/admin-suave.spec.ts` (claro y oscuro, sin scroll horizontal ni elementos fuera de pantalla).

**Por qué así:** en Buscar se descartó paginar el mapa por separado: los pines usan la misma lista cargada.

**Queda abierto:** el total real de la búsqueda no existe en la API (habría que sumar un `total` o un header en el backend). `ShiftCard` solo se ve hoy en la landing (`ActoOido`, `ActoLlegada`); no se pudo capturar renderizado ahí. `SKILL_HERO_TONE` y `heroTile` podrían borrarse si nadie más los usa.
