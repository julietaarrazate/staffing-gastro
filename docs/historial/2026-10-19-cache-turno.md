# Caché de 60 s en el borde para /turno/[id]

**Pedido:** Julieta, 2026-10-19. Quería optimizar Cloudflare para que se
sienta tan rápido como Vercel, "si es para mejor, gratis y no rompe".

**Qué se midió:**

- 33 de las 39 rutas ya salen prerenderizadas y con `enableCacheInterception`
  (configurado desde la etapa 1). La mayor parte de la demora que se ve desde
  la nube de la sesión es la red: un JS servido desde la caché del CDN tardó
  entre 0,2 y 0,6 s.
- `/turno/[id]`, la página que se comparte por WhatsApp, tardaba entre 1,3 y
  2 s desde el celular de Julieta en Argentina. Se arma en cada visita y le
  pide el turno a Render (Ohio).
- Smart Placement se descartó: mueve todo el Worker, y las 33 páginas
  estáticas saldrían desde Ohio en vez de Buenos Aires.

**Qué cambió:**

- `frontend/cloudflare/worker.mjs`: entrada propia del Worker. Envuelve el
  handler de OpenNext y reexporta sus Durable Objects. `wrangler.jsonc`
  apunta acá.
- `frontend/cloudflare/turno-cache.mjs`: guarda 60 s en la Cache API una sola
  copia por turno, con la ruta como clave (`?ref=wa` no genera otra). Deja
  afuera los métodos que no son GET, los pedidos RSC, lo que no es 200 y las
  respuestas con `Set-Cookie`.
- `frontend/cloudflare/turno-cache.test.ts`: 5 tests.

**Por qué así:** el servidor arma esa página igual para cualquiera; lo que
depende de la sesión lo completa `ShiftDetail` en el navegador. La Cache API
es gratis y no necesita R2 ni cambios en el panel. Como mucho, quien abre el
link ve el turno con un minuto de atraso; para postularse igual entra a la
app, que tiene el dato al día.

**Cómo se verificó** (`wrangler dev` con el build de Cloudflare):

- Primera visita a un turno: 0,8 s. Las siguientes: 0,01 s, con el mismo
  `og:title`.
- `/`, `/login`, `/privacidad`, `/feed` y `/og/oido.jpg`: 200.
- Los avisos `StaticAssetsIncrementalCache: Failed to set` y el 307 a un
  pedido RSC sin `_rsc` aparecen igual sin este cambio.

**Queda abierto:** medir en producción, desde Argentina, después del merge.
