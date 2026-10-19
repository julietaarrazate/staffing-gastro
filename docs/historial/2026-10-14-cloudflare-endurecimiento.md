# Mudanza a Cloudflare, etapa 3: endurecimiento

**Pedido:** Julieta (2026-10-13): WAF y protección anti-robots, límite de
intentos en login, registro y recuperar contraseña, Turnstile en registro y
login verificado por el backend, cabeceras de seguridad, y el backend detrás
de Cloudflare sin que Render acepte tráfico de otro lado. Con explicación
clara de qué protege cada cosa y qué no.

**Qué cambió:** nada visible hasta que se prenda (todo depende de variables
que hoy están vacías). Ya está el código:

- `backend/app/core/edge.py`: sólo se entra por Cloudflare (`EDGE_SHARED_SECRET`)
  y la IP real para el límite de intentos. Cubre también los WebSockets.
- `backend/app/core/turnstile.py`: Turnstile en `/auth/login` y
  `/auth/register`. El registro hace dos pedidos con el mismo token
  (registrar y entrar), así que un token válido se acepta una vez más,
  misma IP, dentro de 2 minutos.
- Frontend: `components/TurnstileWidget.tsx` y `lib/turnstile.ts` en `/login`
  y `/register` (sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no se muestra);
  `next.config.ts` suma Cloudflare a la CSP sólo con la clave, y agrega HSTS
  (Vercel lo ponía solo; en Cloudflare lo pone la app).
- `render.yaml` y `backend/.env.example`: las dos variables nuevas.
- Runbook de los paneles en `docs/reference/DEPLOY.md` ("Etapa 3") y
  ADR-0018.

Capturas de `/login` y `/register` con la clave de prueba de Cloudflare, en
claro y oscuro: el widget toma el ancho del formulario y el tema de la app.

**Qué protege cada cosa, y qué no:**

| Pieza | Protege | No protege |
| --- | --- | --- |
| Backend sólo por Cloudflare | Que alguien rodee el WAF y los límites entrando directo a Render | Nada de lo que pase por Cloudflare: el resto de las piezas |
| WAF (reglas gestionadas gratis) | Ataques conocidos y automáticos (inyecciones típicas, escáneres) | Fallas de lógica propias de Oído: eso es el backend |
| Bot Fight Mode | Robots básicos y scrapers conocidos | Robots buenos que imitan un navegador real |
| Límite de intentos (borde y backend) | Adivinar contraseñas o el PIN probando miles de veces; llenar el registro | Un ataque lento desde muchas IPs distintas |
| Turnstile | Registros y logins automatizados en masa | Una persona real con malas intenciones; contraseñas filtradas en otro sitio |
| HSTS | Que una red pública lleve a alguien a una versión sin HTTPS | Nada una vez que el sitio ya está en HTTPS |
| CSP | Limita lo que puede hacer un código malicioso inyectado en la página | Sigue con `'unsafe-inline'`: no frena un XSS que escriba código en la página |

Lo central no cambia: **el código del frontend siempre se puede descargar y
leer**. La seguridad real está en que el backend decida todo (permisos,
estados, montos) y no confíe en el navegador; la auditoría de la etapa 2
confirmó que hoy es así.

**Por qué así:** secreto compartido y no túnel ni lista de IPs (ADR-0018).
Turnstile sólo en login y registro, como se pidió; recuperar contraseña ya
tiene su límite silencioso y queda cubierto por la regla del borde.

**Queda abierto:** prenderlo en los paneles, en el orden del runbook (necesita
la cuenta de Cloudflare de Julieta). La CSP con nonces (sacar
`'unsafe-inline'`) obliga a renderizar todas las páginas por pedido; se evalúa
aparte con la medición de costo en Workers.
