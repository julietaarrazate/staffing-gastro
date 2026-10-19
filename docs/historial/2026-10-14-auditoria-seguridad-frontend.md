# Mudanza a Cloudflare, etapa 2: auditoría de seguridad del frontend

**Pedido:** Julieta (2026-10-13) quiere saber qué ve alguien que le hace
ingeniería inversa a Oído, antes de mudar el frontend a Cloudflare: qué expone
el código publicado, si el navegador decide cosas que debería decidir el
backend, cabeceras, CSP, CORS y tokens. Lo que se encuentre se arregla o se
lista en un documento privado, no en el repo (es público).

**Cómo se revisó:** tres frentes en paralelo. El código que descarga el
navegador (build local y archivos de producción), la app en vivo desde afuera
(pedidos con curl que no escriben nada) y la lógica cliente/servidor leyendo
el código del frontend y del backend.

**Resultado:** sin fallas graves. Los permisos, la propiedad de cada recurso y
los datos sensibles (estado del turno, verificación, plan, calificación) los
decide el backend. El código publicado no trae claves privadas ni mapas del
código fuente. La documentación de la API no es pública y CORS sólo responde
al dominio propio. El detalle de lo pendiente está en el documento privado de
Julieta.

**Qué cambió en este PR:**

- `backend/app/core/url.py`: tipo `HttpsUrl` para las URLs que carga el
  usuario (foto, CV, logo, portada, DNI, selfie, constancia). Antes eran
  texto libre. Test en `backend/tests/test_url_validation.py`.
- `frontend/lib/safe-url.ts`: `safeHttpsUrl` para poner URLs de usuario en un
  `href` (cubre lo ya guardado) y `normalizeUserLink`, que completa
  `https://` cuando alguien pega `linkedin.com/...` en "O pegá un link" del CV,
  para que el cambio del backend no rechace links que antes andaban. Se usa en
  `app/workers/[id]/page.tsx`, `components/CvUpload.tsx`,
  `components/WorkerProfileForm.tsx` y `components/admin/IdentityReviewQueue.tsx`.
- `app/turno/[id]/page.tsx`: un id que no es UUID (o un 422 del backend) da
  "no encontrado" en vez de 500, y `og:url` usa la dirección fija del sitio en
  vez de armarla con headers del pedido. Un solo pedido al backend por visita
  (`React.cache`).
- `next.config.ts`: `vercel.live` sólo en la CSP de las vistas previas de
  Vercel.

**Por qué así:** la validación va en los dos lados. El backend es el que
manda; el frontend cubre los datos viejos. Se exige `https://` y no el host de
Cloudinary porque el CV admite links a Drive o LinkedIn.

**Queda abierto:** la lista del documento privado. Lo de CSP con nonces, IP
real para el límite de intentos y HSTS va en la etapa 3 (Cloudflare); el
resto, en PRs aparte.
