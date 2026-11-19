# El CV del trabajador pasa a privado, con link que vence (PRI-03)

**Pedido:** la pasada de privacidad del 2026-11-19 encontró (grave,
verificado) que el CV —teléfono, email, domicilio— se subía a Cloudinary
como archivo público y sin vencimiento. Quien vio el link una vez (un
comercio con un turno o una postulación de la persona) lo seguía abriendo
para siempre, aunque ella cambiara o sacara el CV: el archivo viejo no se
borraba. El ADR-0021 (documentos privados) había dejado el CV afuera por
omisión.

**Qué cambió:** para la persona, nada a la vista: sigue subiendo, viendo,
reemplazando y sacando su CV desde el perfil. Para el comercio, «Ver CV» y
«Descargar» piden un link en el momento de tocar; si no llega, dice «No
pudimos abrir el CV. Probá de nuevo en un rato.». Por dentro:

- `backend/app/core/cloudinary.py`: `sign_cv_upload(user_id)` firma
  `type=private` y un nombre de archivo con la marca (HMAC) de quien lo sube
  (`cv_public_id_for`, `is_cv_upload_of`). El parser de URLs de Cloudinary
  vive acá ahora (lo comparten los dos scripts) y `private_download_url`
  acepta `attachment`.
- `backend/app/modules/worker/`: el perfil guarda la referencia del archivo
  (`cv_public_id`, `cv_resource_type`, `cv_format`, `cv_delivery_type`,
  migración `0060_cv_privado`); `WorkerProfile.change_cv` devuelve el
  archivo que se deja de usar; puertos `CvFileStorage` y
  `CvFileDeletionQueue`, adaptadores en `infrastructure/cv_files.py`;
  `GET /workers/{id}/cv-link` (5 minutos; dueño, admin o comercio con
  vínculo; el resto, 404). El perfil ajeno trae `cv_kind` en vez de una URL.
- El archivo viejo entra a la cola de borrado del ADR-0021
  (`verification/infrastructure/file_cleanup_job.queue_file_deletions`) en
  el mismo commit que el perfil, y se borra después de responder con los
  reintentos del scheduler.
- `backend/scripts/privatize_worker_cvs.py`: mira por defecto; con
  `--apply` pasa a privados los CV viejos que apunta un perfil y borra los
  huérfanos de `oido/cv/`.
- Frontend: `lib/cv.ts` (pide el link y abre la pestaña dentro del toque),
  `components/CvUpload.tsx` (la referencia, no una URL),
  `components/WorkerProfileForm.tsx`, `app/workers/[id]/page.tsx`. Sale
  `cldAttachment`.
- Tests: `backend/tests/test_cv_privado.py` (el repro de PRI-03, la marca,
  el link y su regla, el borrado y su reintento, la versión vieja de la
  app, el script), `frontend/lib/cv.test.ts`, `frontend/e2e/cv-privado.spec.ts`.

**Por qué así:** el modelo del ADR-0021 (privado + link que vence +
borrado con reintentos), que ya anda para el DNI y la constancia. Dos cosas
propias del CV:

- **La marca en el nombre.** El link que vence muestra el `public_id`, y a
  diferencia del DNI (lo ve sólo un admin), el CV lo ve un comercio. Sin la
  marca, ese comercio se hacía una cuenta de trabajador, se ponía el archivo
  y tenía links para siempre. Se descartó guardar en la base qué cuenta
  firmó cada subida: más tabla para lo mismo.
- **Una versión vieja de la app no borra el CV.** Si el pedido trae
  `cv_url` y no `cv_file`, el archivo se conserva. Se descartó romperle el
  guardado a la PWA en caché (como pasó con el DNI): acá un guardado de otra
  parte del perfil habría borrado el CV en silencio.

Un CV viejo (URL pública) que se cambia antes de correr el script no se
borra desde la app: desde la URL no se sabe con certeza que sea un CV. Lo
borra el script, que mira la carpeta.

**Queda abierto:**

- Julieta corre `python -m scripts.privatize_worker_cvs` (primero sin
  `--apply`) después del deploy: `docs/reference/PENDIENTE_OPERATIVO.md`,
  ítem 5c.
- `/privacidad` no dice que el comercio con un turno o una postulación ve
  el CV ni cuánto se guarda. No se tocó: necesita el sí de Julieta y subir
  la versión legal (texto propuesto en el ADR-0021).
- La regla de quién ve el CV incluye vínculos pasados (una postulación
  retirada sigue contando). Que un vínculo «termine» es otra decisión de
  producto.
- La migración se numeró `0060` sobre la `0058`: la `0059` es de la rama de
  sesión. Al integrar, re-encadenar.
