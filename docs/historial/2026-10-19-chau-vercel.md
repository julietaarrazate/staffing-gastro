# Vercel retirado: privacidad, CORS y links de mails sin Vercel

**Pedido:** Julieta, 2026-10-19. Terminar la mudanza el mismo día del cambio
de DNS, en lugar de dejar Vercel unos días de respaldo.

**Qué cambió en el código:**

- `/privacidad`:
  - se saca Vercel de la lista de proveedores;
  - la línea de Cloudflare suma que sirve la app web;
  - `LEGAL_TERMS_VERSION` pasa a `2026-10-19-2` en backend y en
    `frontend/lib/legal.ts`. Es el segundo cambio del texto en el día; el
    mes visible sigue siendo octubre 2026.
- `CORS_ORIGINS` (`render.yaml`) deja de incluir
  `https://staffing-gastro.vercel.app`.
- **Links de los mails:** `frontend_url` caía por defecto en
  `https://staffing-gastro.vercel.app` (`backend/app/core/config.py`) y
  `render.yaml` no fijaba `FRONTEND_URL`. Al pausar Vercel, los links de
  verificar email, restablecer contraseña y turnos podían quedar rotos. Ahora
  el default es `https://www.oido.com.ar` y `render.yaml` lo fija igual.
- `docs/reference/DEPLOY.md`: la sección de Vercel queda como retirada.

**Qué cambió en los paneles** (con Claude in Chrome):

- **Vercel:** Git desconectado del proyecto `staffing-gastro`. Después se
  sacan los dominios y se pausa el proyecto, sin borrarlo.
- **Google:** el cliente OAuth "Staffya web" deja de tener el origen y las
  URIs de redirección de Vercel.
- **Cloudflare:** se borra el comodín `*` del DNS, que apuntaba a Vercel.

**Por qué así:** el sitio ya andaba en Cloudflare con la prueba de Julieta
(login, navegación, subir foto). Dejar Vercel a medias seguía gastando su
cuota de cómputo con cada merge y dejaba links de mails apuntando a un
dominio que se iba a apagar.

**Queda abierto:** HSTS de la zona (paso 7 de la etapa 3), en unas semanas.
