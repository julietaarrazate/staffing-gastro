# Dominio `api.oido.com.ar` declarado en `render.yaml`

**Pedido:** Julieta, 2026-10-15, siguiendo la etapa 3 de Cloudflare con
Claude in Chrome. Al ir a agregar el dominio de la API en Render, la sección
*Custom Domains* no aparece en Settings de `staffya-backend`.

**Qué cambió:**

- `render.yaml`: `domains: [api.oido.com.ar]` en el servicio
  `staffya-backend`. El servicio es *Blueprint managed*, así que el dominio
  se declara en el archivo y Render lo toma al sincronizar el blueprint.
- `docs/reference/DEPLOY.md`, Etapa 3:
  - el paso 1 dice dónde va el dominio;
  - el paso 2 corrige el orden: `EDGE_SHARED_SECRET` en Render va **después**
    de que el frontend publicado use `api.oido.com.ar`. Antes la guía lo ponía
    antes del cambio de `NEXT_PUBLIC_API_URL`, y en ese orden el sitio, que
    todavía llamaba a `onrender.com`, se quedaba sin login.

**Por qué así:** con un blueprint, lo que está en `render.yaml` es la fuente
de verdad del servicio; agregarlo a mano (si el panel lo permitiera) quedaría
desalineado del archivo.

**Queda abierto:** el resto de la etapa 3 (CNAME en Cloudflare, verificación
en Render, reglas del borde, variables), que se hace con Julieta.
