# ADR-0018 — Backend detrás de Cloudflare con secreto compartido

**Estado:** propuesto (se acepta al prenderlo con el runbook de DEPLOY.md,
"Etapa 3") · **Fecha:** 2026-10-14

## Contexto

El backend (FastAPI en Render) se publica en `staffya-backend.onrender.com` y
cualquiera puede pegarle directo. Dos consecuencias vistas en las auditorías
del 2026-10-10 y 2026-10-14:

- Un WAF, un límite de intentos o un anti-robots puestos en Cloudflare no
  sirven de nada si se los puede rodear entrando directo a Render.
- El backend ve la IP del proxy de Render y no la de cada persona, así que
  el límite de intentos de login es uno solo para todos.

Render no permite limitar quién se conecta a un servicio web.

## Decisión

- La API pasa a `api.oido.com.ar`, con proxy de Cloudflare.
- Una regla de Cloudflare agrega a cada pedido un secreto (`X-Oido-Edge`) y la
  IP real (`X-Oido-Client-IP`). El backend (`app/core/edge.py`) rechaza con
  403 lo que no trae el secreto, salvo `/health`, y sólo con el secreto confía
  en esa IP.
- Turnstile en login y registro, validado por el backend
  (`app/core/turnstile.py`).
- Todo se prende por variables de entorno y viene apagado.

Se descartó Cloudflare Tunnel: Render no deja correr `cloudflared` al lado del
servicio. Y una lista de IPs de Cloudflare: el backend vería la de Render,
no la de Cloudflare.

## Consecuencias

- El secreto es una contraseña compartida entre Cloudflare y Render: si se
  filtra, se cambia en los dos lugares. Entre un cambio y el otro hay unos
  segundos de 403, así que conviene hacerlo con poco tráfico.
- Si Cloudflare se cae, la API se cae con él (antes dependía sólo de Render).
- El límite de intentos del backend sigue en memoria y por proceso; ahora
  cuenta por persona.
