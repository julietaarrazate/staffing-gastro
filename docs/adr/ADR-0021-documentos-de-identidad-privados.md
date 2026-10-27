# ADR-0021 — Documentos de identidad privados en Cloudinary, con link que vence

**Estado:** aceptado · **Fecha:** 2026-10-23 · **Ampliado:** 2026-10-23, «Borrado al decidir» · **Complementa a:** ADR-0010 (§4, retención), ADR-0013 (constancia de AFIP)

## Contexto

El DNI, la selfie y la constancia de AFIP subían a Cloudinary con entrega
pública (`type=upload`): la base guardaba la URL de `res.cloudinary.com`, la
cola del admin la mostraba tal cual, y cualquiera con ese link veía el
documento para siempre. El nombre del archivo es al azar (128 bits), así que
el riesgo no era que lo adivinaran sino que se filtrara (historial del
navegador, una captura, un reenvío). Además, al aprobar o rechazar se borraba
sólo el puntero en la base: el archivo seguía público
([revisión de seguridad del 2026-10-20](../historial/2026-10-20-revision-seguridad-clave-gemini.md),
ítem "Media — documentos de identidad"). Julieta aprobó el arreglo.

## Decisión

1. **Los documentos de identidad suben `type=private`.** El backend agrega
   `type=private` a los parámetros firmados de la subida (`app/core/cloudinary.py`,
   `sign_image_upload("identity")` y `sign_business_document_upload`): el
   cliente no puede subirlos públicos sin invalidar la firma. Foto de perfil,
   logo y portada siguen públicos (se muestran a todos). El CV queda fuera de
   este ADR.
2. **La base guarda la referencia, no una URL.** `identity_evidences` suma
   `file_public_id`, `file_resource_type`, `file_format` y
   `file_delivery_type` (migración `0039`). El envío
   (`POST /identity/me/document`, `/identity/me/business`) recibe esa
   referencia —lo que devuelve Cloudinary al subir— y ya no acepta URLs. El
   `public_id` tiene que ser de la carpeta del flujo (`oido/identidad/` u
   `oido/constancias/`, con o sin el prefijo según el modo de carpetas de la
   cuenta) y `type` sólo puede ser `private`.
3. **El admin ve cada evidencia con un link que vence a los 5 minutos.**
   La cola (`GET /identity/claims/pending`) ya no trae URLs: trae
   `evidence_id`, tipo y si hay archivo. La pantalla pide
   `GET /identity/evidences/{evidence_id}/link` por cada una. Sólo admin
   (otro rol → 403, igual que el resto de la cola); inexistente, purgada o de
   un claim ya decidido → 404 (no se revela qué existe). El dueño ve el
   estado de su claim y no puede volver a bajar el archivo. Si el admin
   abre una evidencia después de que venció el link, la pantalla pide otro
   en el momento.
4. **El link es la API de descarga privada de Cloudinary, no una URL de
   entrega.** `GET https://api.cloudinary.com/v1_1/<cloud>/<resource_type>/download`
   con `public_id`, `format`, `type`, `expires_at` y `timestamp`, firmados
   con el `api_secret` (lo mismo que arma `cloudinary.utils.private_download_url`
   del SDK oficial). Entrega el original y deja de andar en `expires_at`.
   Puerto `EvidenceLinkSigner` en el dominio; adaptador
   `CloudinaryEvidenceLinkSigner` en infraestructura.
5. **Los archivos ya subidos se pasan a privados con un script**
   (`backend/scripts/privatize_identity_evidence.py`), ver "Migración".
6. **Al aprobar o rechazar, los archivos se borran de Cloudinary**
   (2026-10-23, decisión de Julieta; ver «Borrado al decidir»). La política
   de privacidad ya lo prometía ("se borran apenas se aprueba o rechaza").

### Por qué así y no otra cosa

- **Token-based authentication** (URLs de `res.cloudinary.com` con
  `__cld_token__` y vencimiento) es la forma "linda", pero es de los planes
  pagos de Cloudinary (Advanced o superior). Oído está en el plan gratis.
- **`type=authenticated` + URL firmada (`s--…--`)**: la firma de una URL de
  entrega **no vence**: sirve hasta que se rota el `api_secret`. Un link
  filtrado seguiría abriendo el DNI. Además, `expires_at` en la API de
  descarga está pensado para recursos `private` (respuesta del equipo de
  Cloudinary en su foro); por eso `private` y no `authenticated`.
- **Hacer pasar el archivo por el backend (proxy)**: ataría el ancho de banda
  de Render (plan gratis) a cada imagen y no agrega nada sobre un link que
  vence en 5 minutos.

### Fuentes

No se pudo abrir cloudinary.com desde la sesión (proxy), así que los
parámetros se confirmaron en el **código del SDK oficial** (`cloudinary`
1.46.3 de PyPI: `utils.private_download_url`, `utils.sign_request`,
`uploader.rename`, `api.resources`) y en estas páginas:

- Control de acceso (private, authenticated, token-based):
  <https://cloudinary.com/documentation/control_access_to_media>
- `private_download_url` y `expires_at` para recursos privados, y token auth
  como función paga: <https://community.cloudinary.com/discussion/comment/764/>,
  <https://community.cloudinary.com/discussion/comment/784>
- Cambiar el tipo de un archivo existente con `rename` + `to_type`:
  <https://support.cloudinary.com/hc/en-us/community/posts/4511376378770-How-to-convert-public-delivery-types-to-authenticated-delivery-type-for-existing-media>
- Referencia de `rename` (Upload API):
  <https://cloudinary.com/documentation/image_upload_api_reference#rename_public_id>
- Listar por carpeta (Admin API, `resources` con `prefix` y `by_asset_folder`):
  <https://cloudinary.com/documentation/admin_api#get_resources>

## Borrado al decidir (2026-10-23)

Antes, decidir sólo borraba el puntero en la base (`Evidence.purge_data`) y el
archivo quedaba en Cloudinary. Ahora:

1. **El puntero pasa a una cola, en el mismo commit.** `Claim.approve`/`reject`
   purgan la evidencia como antes, pero cada archivo que apuntaba queda en
   `Claim.files_to_delete`, y `SqlAlchemyClaimRepository` lo guarda en
   `identity_evidence_file_deletions` (migración `0043`) junto con la
   decisión. Si se guardó la decisión, se guardó el pedido de borrar.
2. **Se borra después de responder.** La ruta deja el borrado en una
   `BackgroundTask` con sesión propia (`file_cleanup_job.delete_released_files`):
   el admin no espera a Cloudinary, y si Cloudinary falla la decisión igual
   sale. El borrado es `destroy` de la Upload API (`POST /<rt>/destroy` con
   `public_id`, `type=private`, `invalidate=true`, firmado; el mismo pedido
   que `cloudinary.uploader.destroy` del SDK 1.46.3), detrás del puerto
   `EvidenceFileStorage` (adaptador `CloudinaryEvidenceFileStorage`).
3. **Recién al confirmar se olvida la referencia.** `{"result": "ok"}` o
   `{"result": "not found"}` (ya no estaba) borran la fila de la cola.
   Cualquier otra cosa —red, credenciales, `CLOUDINARY_CLOUD_NAME` sin
   cargar, un HTTP 404 (también es un `cloud_name` que no existe)— deja la
   fila con `attempts`, `last_error` y `next_attempt_at`.
4. **El scheduler reintenta.** `run_evidence_file_cleanup` es un chequeo más
   del scheduler en proceso: reintenta lo que ya toca y devuelve la hora del
   próximo reintento, que se espacia (15 min, 30 min, 1 h… hasta una vez por
   día, sin rendirse). Con la cola vacía no agrega despertares (cuota de
   Neon). Desde el quinto intento fallido el aviso sale como error (Sentry).
   Entra al scheduler desde `app/main.py` (`extra_checks`), para que
   `shift/application/scheduler.py` no importe la infraestructura de
   verificación (candado de capas).
5. **Un reenvío estando pendiente** también manda a la cola los archivos que
   reemplaza: nadie los va a revisar.

**Por qué una cola aparte y no un "pendiente" en la evidencia.** Con el
puntero en la evidencia hasta confirmar, un trabajador rechazado que reenvía
antes de que Cloudinary confirme pisa sus evidencias (el reenvío las
reemplaza) y la referencia se pierde. La cola no cuelga del claim (sin FK): si
el claim o la cuenta desaparecen, el archivo igual se borra.

## Migración (archivos ya subidos)

Orden: **(1)** mergear y desplegar (Render corre las migraciones `0039` y
`0043`), **(2)** cargar `CLOUDINARY_CLOUD_NAME` en Render (el mismo valor que
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` del frontend), **(3)** correr el script.

El script es **idempotente** y por defecto **no cambia nada** (dry-run):

1. Para cada evidencia con URL pública todavía en la base (claims
   pendientes), cambia el archivo a `private` (`POST /<rt>/rename` con el
   mismo `public_id`, `type=upload`, `to_type=private`, `invalidate=true`
   para sacarlo de la caché del CDN) y guarda la referencia privada en la
   fila. Si el archivo ya era privado (una corrida que se cortó), sólo
   actualiza la fila. Siguen esperando la revisión.
2. Recorre `oido/identidad/` y `oido/constancias/` (Admin API, por prefijo
   para cada tipo de entrega y por carpeta) y **borra** (`destroy`) los
   archivos que ninguna evidencia de la base apunta: los de claims ya
   decididos antes del borrado al decidir, y subidas que nunca se enviaron.
   No toca lo que apunta una evidencia ni lo subido hace menos de 24 h
   (puede ser de alguien completando el formulario). *Cambio del
   2026-10-23: antes este paso los pasaba a privados.*

Se corre desde una compu con el repo (Render free no tiene consola):

```bash
cd backend
export DATABASE_URL='<connection string DIRECTA de Neon, sin -pooler>'
export CLOUDINARY_CLOUD_NAME='<cloud name>'
export CLOUDINARY_API_KEY='<api key>'
export CLOUDINARY_API_SECRET='<api secret>'
python -m scripts.privatize_identity_evidence          # mira y lista
python -m scripts.privatize_identity_evidence --apply  # privatiza y borra
python -m scripts.privatize_identity_evidence          # filas, a privado y huérfanos en 0
```

Entre el deploy y la corrida, las evidencias viejas pendientes se siguen
viendo en la cola: el endpoint de link devuelve su URL vieja (sin
vencimiento) hasta que el script las migra. Si una de esas se decide antes de
correr el script, su archivo queda huérfano (no tiene referencia para la
cola) y lo borra el paso 2.

## Consecuencias

- Un link filtrado de un DNI deja de servir a los 5 minutos; una URL vieja
  deja de servir apenas corre el script.
- Al aprobar o rechazar, el archivo se borra de Cloudinary a los segundos
  (si Cloudinary falla, en el próximo reintento). "Las eliminamos una vez
  revisadas" y "No guardamos tu DNI" (tarjetas de verificación) pasan a ser
  exactos.
- `CLOUDINARY_CLOUD_NAME` pasa a ser variable del backend. Sin ella el admin
  no puede abrir las evidencias nuevas (503 con mensaje claro); nada más se
  rompe.
- Una versión vieja de la app (PWA en caché) que intente subir un DNI falla
  la firma (no manda `type`) y muestra "No se pudo subir el archivo. Probá de
  nuevo."; al recargar toma la nueva.

## Queda abierto

- **Subidas que nunca se envían.** Si alguien sube su DNI y no envía el
  formulario (o cambia la foto antes de enviar), el archivo queda en
  Cloudinary sin que la base lo apunte. No hay un barrido periódico: listar
  las carpetas usa la Admin API, que en el plan gratis tiene un tope por
  hora. Volver a correr el script (es idempotente) los borra.
