# Mudanza a Cloudflare, etapa 1: prueba de compatibilidad

**Pedido:** Julieta (2026-10-13) quiere mudar el frontend de Vercel Hobby a
Cloudflare antes de la beta comercial, con la seguridad como prioridad. Plan
en cinco etapas; esta es la primera: armar Oído para Cloudflare en una rama y
correr toda la batería de tests contra el Worker servido local, sin tocar
producción.

**Qué cambió:** nada visible. Producción sigue en Vercel. En `frontend/`:

- `wrangler.jsonc`, `open-next.config.ts` y los scripts `cf:build`,
  `cf:preview` y `cf:deploy` en `package.json`.
- `patches/@opennextjs+cloudflare+1.20.10.patch` (con `patch-package` en el
  `postinstall`): sin él, Next 16.4 pide `preview-props.json`, OpenNext no lo
  empaqueta y **todas** las páginas daban 500.
- `scripts/cf-static-assets.mjs`: `/og/oido.jpg` y `/twitter-image` daban
  500 en el Worker (usan `sharp` y fuentes del disco). Ahora se copian del
  build a los assets estáticos. También escribe `_headers` para esos assets.
- `eslint.config.mjs` ignora `.open-next/` y `.wrangler/`.

**Resultado contra el Worker local (`wrangler dev`, puerto 3100):** tsc sin
errores; lint sin errores (los avisos son los mismos de `main`); Vitest 164/164;
Playwright **138/138** (no 146: se contaron hoy 138 tests en 44 specs). Con 4
procesos en paralelo, los 2 recorridos largos de `overflow-audit` pasaban los
30 s por la lentitud del Worker local en la máquina de la sesión; solos, y con
2 procesos, pasan.

Revisado a mano: `/`, `/login`, `/register`, manifest de la PWA, `sw.js`,
`robots.txt`, `sitemap.xml`, 404, la CSP y las demás cabeceras (salen igual
que en Vercel), las dos imágenes de vista previa (JPEG 1200×1200 y PNG
1200×630) y `next/font` (las fuentes se sirven desde el propio sitio).

**Por qué así:** OpenNext en vez de vinext, con la prueba en
[ADR-0017](../adr/ADR-0017-frontend-en-cloudflare-workers.md). Las imágenes de
vista previa se sirven como archivos y no se reescribieron para Workers: así
la ruta de Next queda igual para Vercel y no se tocó el diseño ni el JPEG
elegido para WhatsApp.

**Visto de paso (ya pasaba en Vercel, no es de la mudanza):** `/turno/abc`
(id que no es UUID) da 500 en vez de 404: el backend responde 422 y la página
sólo trata el 404. Va a la auditoría de la etapa 2.

**Queda abierto:** etapas 2 a 5 (ítem en `STATUS.md`). Para el pase a
producción: previews por PR con versiones de Worker, variables de entorno en
Cloudflare (`NEXT_PUBLIC_SENTRY_DSN`, etc.), sacar `vercel.live` de la CSP,
cambiar Vercel por Cloudflare en `/privacidad` (sube `LEGAL_TERMS_VERSION`) y
un job de CI que haga `cf:build`. La analítica de Vercel no se usa
(`@vercel/analytics` no está instalado).
