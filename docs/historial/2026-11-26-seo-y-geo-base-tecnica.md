# SEO y GEO: la base técnica (#753)

**Antes:** la página pública de un turno no le decía a Google que era una
oferta de trabajo ni tenía dirección canónica. Términos, Privacidad, ingreso y
registro heredaban `og:url "/"` (se declaraban como la portada); ingreso y
registro, además, el título genérico. Varias pantallas de la app (publicar un
turno, soporte, favoritos, buscar) podían indexarse vacías. El mapa del sitio
ponía la hora del pedido como fecha de cambio. No había `llms.txt`.

**Después:**
- `/turno/[id]` emite `JobPosting` (puesto, fechas, zona, pago por hora y el
  comercio como quien contrata, nunca Oído) y `<link rel="canonical">`. Sin
  nombre del comercio o sin fecha de publicación no emite nada.
- La vista pública del turno suma `published_at` (lo exige `datePosted`).
- Dirección canónica y título propios en `/terminos`, `/privacidad`, `/login`
  y `/register`; el `openGraph.url` fijo salió del layout.
- `robots.txt` suma `/shifts`, `/support`, `/assistant`, `/favorites`,
  `/bienvenida`, `/verificar-email` y `/buscar`.
- `public/llms.txt`, con lo que la portada ya afirma.
- Mapa del sitio sin `lastModified`; `<html lang="es-AR">`.

**Cómo:** `frontend/lib/seo.ts` (`jobPostingDe`, `jsonLd`),
`app/turno/[id]/page.tsx`, `app/login/layout.tsx` y `app/register/layout.tsx`
(nuevos: las páginas son de cliente), `app/robots.ts`, `app/sitemap.ts`,
`app/layout.tsx`; `ShiftPublicResponse.published_at`. Lo que queda, en el
tablero («Etapa 6: SEO y GEO»).

**Pruebas:** `frontend/lib/seo.test.ts` (5), `frontend/e2e/seo.spec.ts` (8),
contrato regenerado.
