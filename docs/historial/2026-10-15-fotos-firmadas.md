# Fotos con subida firmada; ningún preset sin firma

**Pedido:** auditoría de seguridad de la etapa 2 de la mudanza a Cloudflare
(2026-10-14), pendiente de gravedad media: las fotos de perfil, logo, portada,
DNI y selfie subían a Cloudinary con un *upload preset* sin firma cuyo nombre
viaja en el código del navegador.

**Qué cambió:** nada visible. Las fotos se suben igual, pero cada subida la
autoriza el backend:

- `backend/app/core/cloudinary.py`: `sign_image_upload(kind)` y, para **todas**
  las firmas (CV y constancia incluidas), carpeta por tipo (`oido/perfiles`,
  `oido/portadas`, `oido/identidad`, `oido/cv`, `oido/constancias`), un
  `public_id` al azar decidido por el servidor y `overwrite=false`, todo
  dentro de la firma.
- `backend/app/modules/upload/api/routes.py`: `POST /uploads/sign-image?kind=`
  con permiso por tipo: `profile` cualquier usuario, `cover` sólo comercio,
  `identity` sólo trabajador.
- `frontend/lib/cloudinary.ts`: `uploadImage(file, token, kind)` usa la misma
  subida firmada que el CV. Lo llaman `ImageUpload`, `CoverPhotoUpload` e
  `IdentityVerificationCard` con la sesión del usuario.

**Por qué así:** se reusó la subida firmada que ya existía para el CV y la
constancia, en vez de endurecer el preset en el panel (eso deja el permiso
en manos de una configuración que se puede resetear).

**Antes de mergear:** confirmar que Render tenga `CLOUDINARY_API_KEY` y
`CLOUDINARY_API_SECRET`. Sin ellas, la subida de fotos responde 503 (hoy sólo
le pasaría al CV). **Después de mergear:** apagar o borrar el preset
`staffya-profile` en Cloudinary y la variable
`NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` en Vercel.

**Queda abierto:** el tamaño máximo por archivo no se puede fijar en la firma
(Cloudinary lo limita por cuenta); el frontend ya recorta las fotos antes de
subirlas.
