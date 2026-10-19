# Privacidad: Cloudflare en la lista de proveedores

**Pedido:** Julieta, 2026-10-19, preparando la etapa 5 de la mudanza a
Cloudflare. Al revisar `/privacidad` apareció que Cloudflare no figuraba entre
los proveedores. Desde la etapa 3 (2026-10-15) ya maneja el DNS, todo el
tráfico de `api.oido.com.ar` y Turnstile en login y registro.

**Qué cambió:**

- `frontend/app/privacidad/page.tsx`: nueva línea en "Con los proveedores que
  nos ayudan a operar". Dice qué hace Cloudflare (dominio, conexión con el
  servidor, protección, verificación anti-robots) y que ve la IP y datos
  técnicos del navegador.
- `LEGAL_TERMS_VERSION` pasa a `2026-10-19` en
  `backend/app/modules/identity/domain/value_objects.py` y en
  `frontend/lib/legal.ts`, más "Última actualización: octubre 2026".

**Por qué así:** la página tiene que reflejar lo que ya pasa en producción.
Vercel sigue en la lista porque todavía sirve `www.oido.com.ar`. Cuando se
haga el cambio de DNS (etapa 5) y se pause Vercel, se saca esa línea con otra
subida de versión.

**Queda abierto:** sacar Vercel de la lista después del cambio de DNS.
