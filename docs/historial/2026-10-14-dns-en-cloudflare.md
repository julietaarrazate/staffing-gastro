# El DNS de oido.com.ar pasa de Vercel a Cloudflare

**Pedido:** Julieta, para prender el endurecimiento de la etapa 3 (WAF,
límite de intentos, backend detrás de Cloudflare). Hizo los pasos en los
paneles con Claude en Chrome mirándolo ella; esta sesión preparó los pedidos y
verificó antes y después.

**Qué cambió:** nada visible. El dato de que el dominio "ya usaba Cloudflare
como DNS" era falso: estaba en Vercel. Se creó la zona en Cloudflare (plan
Free) con los mismos registros, todos en "DNS only", y se cambiaron los
nameservers en NIC Argentina. Cloudflare marcó la zona activa el mismo día.
Verificado desde dos resolvers (Cloudflare y Google): nameservers nuevos, la
web responde (www 200, apex 308 a www, imagen de vista previa 200), y están
el MX, SPF, DKIM y DMARC de Google y los registros de Resend.

**Por qué así:** la web quedó con CNAME a la dirección del proyecto en Vercel
y no con IPs fijas, porque Vercel las rota (se vio en tres consultas
seguidas). Todo en "DNS only" para que el cambio de nameservers no cambie
nada del tráfico. Se descartó Bot Fight Mode (ver DEPLOY.md, paso 5).

**Queda abierto:** el resto del runbook de la etapa 3 en DEPLOY.md, desde el
paso 1 (`api.oido.com.ar`). El widget de Turnstile ya está creado en
Cloudflare; falta cargar sus claves.
