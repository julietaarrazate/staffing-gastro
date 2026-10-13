# ADR-0017 — Frontend en Cloudflare Workers con OpenNext

**Estado:** propuesto (se acepta al cambiar el DNS, con el "sí" de Julieta) ·
**Fecha:** 2026-10-13

## Contexto

El frontend (Next.js 16.4) corre en Vercel Hobby, que no permite uso
comercial. Antes de la beta comercial hay que pasar a un plan pago: Vercel
Pro cuesta 20 USD/mes y Cloudflare Workers Paid 5 USD/mes. El DNS de
`oido.com.ar` ya está en Cloudflare. El backend (Render) y la base (Neon) no
cambian.

## Decisión

Servir el frontend desde un Worker de Cloudflare armado con **OpenNext**
(`@opennextjs/cloudflare`), que ejecuta el runtime real de Next.

Se evaluó **vinext** (reimplementación de la API de Next sobre Vite): su
chequeo da 97% de compatibilidad, pero el build falla con el código actual
(`import "sharp"` en `app/og/oido.jpg/route.ts`) y, al no ser Next, cada
diferencia de comportamiento sería nuestra. OpenNext pasó tsc, lint, Vitest y
los 138 E2E contra el Worker local con dos ajustes chicos (ver
`docs/reference/DEPLOY.md`).

## Consecuencias

- Dos ajustes propios que hay que revisar al subir de versión: el parche de
  `patches/` (manifiesto `preview-props.json`) y la copia de las imágenes de
  vista previa a los assets (`scripts/cf-static-assets.mjs`).
- Se pierden las previews automáticas por PR de Vercel; se reemplazan con
  versiones de Worker (`wrangler versions upload`) desde CI.
- `/privacidad` nombra a Vercel como proveedor: al cambiar el DNS hay que
  cambiarlo por Cloudflare y subir `LEGAL_TERMS_VERSION` y `lib/legal.ts`.
- Vercel queda unas semanas como respaldo para volver atrás cambiando el DNS.
