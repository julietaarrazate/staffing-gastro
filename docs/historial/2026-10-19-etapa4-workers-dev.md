# Etapa 4: el frontend publicado de prueba en Cloudflare Workers

**Pedido:** Julieta, 2026-10-16 a 2026-10-19. Publicar el frontend en una
dirección de prueba de Cloudflare, sin tocar `www.oido.com.ar`, que sigue en
Vercel.

**Qué cambió:**

- **Cloudflare (panel):** Worker `oido-frontend` con Workers Builds conectado
  a GitHub. Queda en `https://oido-frontend.julietaarrazate.workers.dev` y se
  republica solo con cada merge a `main`. Configuración en
  `reference/DEPLOY.md`, "Etapa 4".
- **Ajustes de paneles para el login en esa dirección:**
  - `CORS_ORIGINS` en Render: hecho;
  - hostname en el widget de Turnstile: hecho;
  - origen en el cliente OAuth de Google: pendiente, Google pidió la
    contraseña de Julieta.
- **Código:**
  - `render.yaml` suma la dirección a `CORS_ORIGINS`. El valor es fijo en el
    Blueprint: si quedaba sólo en el dashboard, la próxima sincronización lo
    pisaba.
  - `frontend/wrangler.jsonc` fija `workers_dev: true` y apaga
    `preview_urls`. Las direcciones por versión no tienen login, porque no
    están autorizadas en ningún lado.

**Cómo se verificó:**

- 23 rutas responden igual que en producción.
- `/turno/[id]` arma en el servidor los datos y el `og:*` igual que Vercel,
  sin errores de CPU en el plan gratis.
- Los encabezados de seguridad salen iguales: CSP, HSTS, `X-Frame-Options`.
- La API responde el preflight CORS para la dirección nueva.

**Corrección de doc:** el límite de tamaño del Worker en el plan gratis ya no
es 3 MB (hoy es 64 MiB); el primer deploy en el plan gratis anduvo.

**Queda abierto:**

- Autorizar la dirección en Google y la prueba de Julieta (login, navegación,
  subir foto).
- Revisar las métricas de CPU del Worker.
- Etapa 5: cambio de DNS, sólo con su "sí".
