# Dependencias: body-parser y undici sin las vulnerabilidades nuevas

**Pedido:** el chequeo de seguridad (`npm audit`) empezó a fallar el
2026-10-27 en todos los PRs por avisos nuevos, sin que nadie tocara las
dependencias.

**Qué cambió:** nada visible. `npm audit fix` actualizó, sólo en
`frontend/package-lock.json` y dentro de los rangos que ya permitía
`package.json`:

- `body-parser` 2.3.0 → 2.4.0 (DoS con bytes de más después de un cuerpo
  comprimido, GHSA-27r3-jxmh-p828).
- `wrangler` 4.152.0 → 4.156.0, que trae un `miniflare` con `undici` 7.30.1
  (DoS en el parser de EventSource, bypass de Subresource Integrity y DoS por
  demasiados content-encodings: GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472,
  GHSA-xjj6-f33q-929c).

Las dos son herramientas de desarrollo y build (wrangler sólo corre al
deployar en Cloudflare); no cambian lo que se sirve.

**Pruebas:** `npm audit` 0 vulnerabilidades, `tsc` OK, Vitest 230/230,
`npm run build` OK y `npm run cf:build` OK.

**Queda abierto:** nada.
