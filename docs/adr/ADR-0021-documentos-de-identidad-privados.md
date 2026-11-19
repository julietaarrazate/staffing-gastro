# ADR-0021 — Documentos de identidad privados en Cloudinary, con link que vence

**Estado:** aceptado · **Fecha:** 2026-10-23 · **Ampliado:** 2026-10-23, «Borrado al decidir»; 2026-11-19, «el CV también» (y `private` → `authenticated`) · **Complementa a:** ADR-0010 (§4, retención), ADR-0013 (constancia de AFIP)

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
   logo y portada siguen públicos (se muestran a todos). El CV quedó fuera de
   este ADR, y fue una omisión: desde el 2026-11-19 también es privado (ver
   «Actualización 2026-11-19: el CV también»). **Corregido el 2026-11-19:**
   `private` no alcanzaba (deja ver sin firma las versiones transformadas);
   desde ahí el tipo es `authenticated`, también para los documentos.
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
  filtrado seguiría abriendo el DNI. (El 2026-10-23 se eligió `private`
  creyendo, por un comentario del foro de Cloudinary, que `expires_at` de la
  API de descarga era sólo para `private`. **Era un error:** la
  documentación oficial dice que `private_download_url` acepta `type`
  `upload`, `private` o `authenticated`; ver «Fuentes».)
  *Revisado el 2026-11-19:* lo que no sirve es la **URL de entrega
  firmada**, no el tipo. `private` deja ver sin firma las versiones
  transformadas, así que se pasó a `authenticated` **sin** URLs de entrega
  firmadas: el link sigue siendo el de la API de descarga con
  `expires_at`. Ver «Actualización 2026-11-19».
- **Hacer pasar el archivo por el backend (proxy)**: ataría el ancho de banda
  de Render (plan gratis) a cada imagen y no agrega nada sobre un link que
  vence en 5 minutos.

### Fuentes

No se pudo abrir cloudinary.com desde la sesión (proxy), así que los
parámetros se confirmaron en el **código del SDK oficial** (`cloudinary`
1.46.3 de PyPI: `utils.private_download_url`, `utils.sign_request`,
`uploader.rename`, `api.resources`) y en estas páginas:

- Control de acceso (private, authenticated, token-based):
  <https://cloudinary.com/documentation/control_access_to_media>. En
  «Providing time-limited access to private media assets», para
  `private_download_url`: `type` admite «upload, private, authenticated», y
  `expires_at` es «The date (UNIX time in seconds) for the URL expiration».
  En la misma página: por defecto, las versiones derivadas (transformadas)
  de un archivo `private` se entregan públicas.
- Token-based auth como función de los planes pagos:
  <https://community.cloudinary.com/discussion/comment/764/>,
  <https://community.cloudinary.com/discussion/comment/784>. (Esos mismos
  comentarios decían que `expires_at` era para recursos `private`: la
  documentación de arriba lo contradice.)
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
   `{"result": "not found"}` (ya no estaba) sacan el pedido de la cola
   (*desde el 2026-11-19 la fila no se borra: queda marcada con
   `deleted_at`, ver «Actualización 2026-11-19»*).
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

## Actualización 2026-11-19: el CV también

**Qué fallaba** (PRI-03, pasada de privacidad del 2026-11-19, grave). El CV
del trabajador trae teléfono, email y domicilio, y subía a Cloudinary como
archivo **público y sin vencimiento**: `sign_cv_upload` no firmaba `type`, y
el perfil guardaba la URL de `res.cloudinary.com`. El candado de
`GET /workers/{id}` (sólo el dueño, admin o un comercio con un turno o una
postulación de esa persona reciben el CV) era de una sola vez: quien vio el
link lo seguía abriendo para siempre, aunque la persona cambiara o sacara el
CV, porque el archivo viejo no se borraba. Este ADR había dejado el CV
afuera sin decir por qué; no fue una decisión de dejarlo público.

**Y `private` tampoco alcanzaba** (revisión independiente del arreglo, el
mismo día; vale también para el DNI, la selfie y la constancia). La
documentación de Cloudinary (*control access to media*) dice que, por
defecto, «any derived (transformed) versions of the asset are publicly
accessible». El link que vence trae la cuenta, el tipo, el
`public_id` y el formato: con eso se arma
`https://res.cloudinary.com/<cuenta>/image/private/w_2000/<public_id>.jpg`
(o `pg_1`, `pg_2`… para cada página de un PDF) y el documento se abre sin
firma y sin vencimiento. `authenticated` pide firma en el original **y** en
cualquier transformación, y la app nunca arma URLs de entrega firmadas: el
único camino es el link de la API de descarga, que vence. El Cloudinary de
mentira del arnés (`tools/e2e-local/fakes.py`) imita las dos reglas, y
`backend/tests/test_cloudinary_entrega.py` prueba las URLs transformadas
sin firma contra él.

**Qué cambia.**

1. **Todo sube `authenticated`.** DNI, selfie, constancia y CV
   (`PROTECTED_DELIVERY_TYPE` en `app/core/cloudinary.py`). El envío de la
   verificación y el perfil aceptan sólo `authenticated` como archivo nuevo;
   las evidencias pendientes `private` de antes se siguen viendo (el link
   lleva su tipo) hasta que el script las pasa. Una versión vieja de la app
   que suba un DNI falla al leer la respuesta (esperaba `private`) y muestra
   «No se pudo subir el archivo de forma privada»; al recargar toma la
   nueva.
2. **El CV lleva la marca de quien lo sube.** `sign_cv_upload(user_id)`
   firma un `public_id` de 64 hex: 32 al azar y 32 de un HMAC de la cuenta
   (`cv_public_id_for`, `is_cv_upload_of`). La marca hace falta porque el
   link que vence muestra el `public_id`: sin ella, un comercio que abrió el
   CV una vez podía crearse una cuenta de trabajador, ponerse ese mismo
   archivo y pedir links para siempre (o hacerlo borrar al «sacarlo»). El
   perfil acepta un archivo nuevo sólo si es `authenticated` y lleva la
   marca de esa cuenta; si no, 422. La clave del HMAC es
   `CLOUDINARY_API_SECRET`: si se rota, sólo falla un CV subido y todavía no
   guardado (se vuelve a subir); los guardados no se vuelven a chequear.
3. **El perfil guarda la referencia, no una URL.** `worker_profiles` suma
   `cv_public_id`, `cv_resource_type`, `cv_format` y `cv_delivery_type`
   (migración `0060`). `PUT /workers/me/profile` recibe `cv_file` (lo que
   devuelve Cloudinary al subir). `cv_url` queda para un **link pegado a
   mano** (Drive, LinkedIn: lo controla la persona, no es un archivo nuestro)
   y para los CV viejos hasta correr el script. Un link de Cloudinary ya no
   entra como «link pegado»; si es `authenticated` y de esa cuenta (lo que
   manda una versión vieja de la app después de subir), se toma como el
   archivo. El mismo archivo se reconoce por `public_id`, tipo de recurso y
   tipo de entrega (`CvFile.same_file`): un pedido con otro `format` no lo
   manda a borrar.
4. **Se ve con un link que vence, sólo a quien hoy puede verlo.**
   `GET /workers/{id}/cv-link` da un `private_download_url` de 5 minutos (con
   `download=true`, como adjunto, para «Descargar»). La regla de quién es la
   de siempre (`_sees_contact` en `worker/api/routes.py`: el dueño, admin o
   un comercio con `EmployerWorkerRelation`); perfil inexistente, sin CV o
   ajeno → 404 igual. El perfil ajeno ya no trae `cv_url` ni la referencia:
   dice qué CV hay (`cv_kind`: `file` o `link`) y el nombre del archivo.
   Sólo el dueño recibe `cv_file` (para mandarlo de vuelta al guardar el
   perfil, que reemplaza y no parchea) y `cv_url`.
5. **El archivo viejo se borra, y lo borrado queda anotado.** Al cambiar o
   sacar el CV, el archivo que se deja de usar entra a la **misma cola** de
   «Borrado al decidir» (`identity_evidence_file_deletions`, por
   `file_cleanup_job.queue_file_deletions`) en el mismo commit que el
   perfil, se borra después de responder y, si Cloudinary falla, lo
   reintenta el scheduler. Desde este cambio, al confirmar un borrado la
   fila **no se borra**: queda marcada (`deleted_at`, migración `0060`). Así
   el perfil sabe qué archivos ya se mandaron a borrar y no los vuelve a
   aceptar (409 «Ese CV ya lo cambiaste o lo sacaste desde otro lado»): era
   un formulario abierto desde antes que, al guardar, dejaba el perfil
   apuntando a un archivo borrado y mandaba a borrar el CV vigente. El
   formulario, además, manda los campos del CV sólo si la persona lo tocó.
   Puertos `CvFileStorage` y `CvFileDeletionQueue` en
   `worker/domain/repositories.py`; adaptadores en
   `worker/infrastructure/cv_files.py`.
6. **Una versión vieja de la app no borra el CV.** Un pedido que trae
   `cv_url` y no `cv_file` (la PWA en caché no conoce el campo) conserva el
   archivo que ya estaba. Sin esto, cambiar la foto desde esa versión
   mandaba `cv_url: null` y borraba el CV.

**Lo que no se borra desde la app.** Un CV viejo (URL pública en `cv_url`)
que se cambia antes de correr el script no se borra en el momento: desde la
URL no se puede saber con certeza que sea un CV (antes de las carpetas,
alguien podría haber pegado la URL de una foto). Lo borra el script.

**La regla de quién ve el CV no cambia.** Un comercio con un turno o una
postulación de la persona, **también pasada**, sigue pudiendo pedir el link
(es la regla vigente desde la revisión del 2026-10-20). Lo que cambia es que
tiene que cumplirla cada vez que lo abre, que un link reenviado deja de
andar a los 5 minutos, y que cuando la persona cambia o saca el CV el
archivo viejo deja de existir. Si se quisiera que el vínculo «termine»
(por ejemplo, que una postulación retirada deje de contar), es un cambio de
la regla del producto, aparte.

**Los scripts** (idempotentes; por defecto miran y no cambian nada; escriben
cada fila sólo si sigue como la leyeron, así un cambio hecho mientras corren
no se pisa):

- `privatize_identity_evidence.py`, paso 1, pasa a `authenticated`
  (`rename` con el tipo que tiene, `to_type=authenticated`,
  `invalidate=true`) las evidencias pendientes con URL pública **o con un
  archivo `private`**. El paso 2 (huérfanos de `oido/identidad/` y
  `oido/constancias/`) sigue igual.
- `privatize_worker_cvs.py`:
  1. Para cada perfil con un CV viejo (URL de Cloudinary en `cv_url`) o un
     CV que no es `authenticated`, pasa el archivo a `authenticated` y
     guarda la referencia, vaciando `cv_url`. No toca —y lo lista para
     mirarlo a mano— un archivo de otra carpeta de la app, uno **sin
     carpeta que usa otra cosa** (foto de perfil, logo, portada o documento
     de identidad: protegerlo rompería esa foto), uno que apuntan dos
     perfiles (si uno lo cambia se le borraría al otro) ni una URL de otra
     cuenta de Cloudinary.
  2. **Borra** lo que ningún perfil apunta, subido hace más de 24 h: todo lo
     de `oido/cv/`, y **sin carpeta** (los CV de antes de las carpetas) los
     Word (`raw`) y los PDF que nada usa **subidos antes del 2026-10-16**:
     desde ese día toda subida de la app trae carpeta, así que un documento
     sin carpeta más nuevo no es de la app (alguien lo subió a mano) y sólo
     se lista. Las fotos sin carpeta que nada usa (jpg, png…) **no las
     toca**: las lista para mirarlas a mano, porque pueden ser un CV en
     imagen o una foto vieja.

**Qué tiene que hacer Julieta** (también en
[`PENDIENTE_OPERATIVO.md`](../reference/PENDIENTE_OPERATIVO.md), ítem 5c),
en este orden, desde una compu con el repo y las mismas variables que el
script de los documentos:

1. Mergear y esperar el deploy (Render corre la `0060`;
   `CLOUDINARY_CLOUD_NAME` tiene que estar cargada).
2. Documentos:

   ```bash
   cd backend
   python -m scripts.privatize_identity_evidence          # mira y lista
   python -m scripts.privatize_identity_evidence --apply  # protege y borra
   python -m scripts.privatize_identity_evidence          # filas, a protegido y huérfanos en 0
   ```

3. CV:

   ```bash
   python -m scripts.privatize_worker_cvs          # mira y lista
   python -m scripts.privatize_worker_cvs --apply  # protege y borra
   python -m scripts.privatize_worker_cvs          # perfiles, a protegido y huérfanos en 0
   ```

4. Mirar a mano lo que los scripts listan con `!` (problemas) y con `?`
   (fotos y documentos sin carpeta que no se tocan).
5. **Prueba obligatoria en producción** (PRI-03 no se da por cerrado sin
   ella): «Ver CV» de un PDF y de una foto se ven en el navegador, el admin
   ve un DNI pendiente, y el link de «Ver CV» copiado deja de abrir a los 6
   minutos. La documentación dice que `private_download_url` vence con
   `expires_at` para `authenticated` (ver «Fuentes»), y el arnés lo imita,
   pero desde la sesión no se pudo abrir Cloudinary para verlo en el
   servicio real.

   **Si el link no venciera**, el arreglo no alcanza (quien lo vio lo
   seguiría abriendo) y hay dos salidas, las dos con ADR nuevo:
   - **Token-based authentication** de Cloudinary: URLs de entrega con
     `__cld_token__` que vencen. Es de los planes pagos (Advanced o
     superior); es la forma prevista por Cloudinary.
   - **Pasar el archivo por el backend**: `cv-link` deja de dar un link de
     Cloudinary y el backend entrega el archivo (lo baja con la API de
     descarga y lo reenvía) a quien puede verlo, en cada pedido. Sin costo
     de Cloudinary, pero usa ancho de banda y memoria de Render (plan
     gratis) por cada CV o DNI que se abre.

Entre el deploy y la corrida, los CV viejos se siguen viendo: `cv-link`
devuelve su URL vieja (sin vencimiento) a quien puede verlos.

**`/privacidad` no se tocó.** Hoy no dice que el comercio con un turno o una
postulación ve el CV, ni cuánto se guarda el CV. Con este cambio se podría
decir «el CV lo ve el comercio con el que tenés un turno o una postulación,
con un link que vence a los minutos; si lo cambiás o lo sacás, lo
borramos». Cambiar ese texto necesita el sí de Julieta y subir
`LEGAL_TERMS_VERSION` y `frontend/lib/legal.ts`.

## Actualización 2026-11-19: la decisión es sobre el envío revisado (ESC-01)

El guardado del pedido reescribía estado y evidencias desde la copia leída
al empezar la decisión. Si la persona reenviaba en ese momento, la admin
aprobaba la evidencia vieja y los archivos del reenvío quedaban en el
storage sin evidencia que los apunte y fuera de la cola de borrado: el
borrado de este ADR dejaba de cumplirse.

- El guardado es condicional: `UPDATE … WHERE status = <leído> AND
  submitted_at = <leído>` (cada cambio del pedido mueve uno de los dos, así
  que sirve de versión sin columna nueva). Si otro guardó en el medio, no se
  escribe nada, ni las evidencias ni la cola.
- Aprobar y rechazar llevan el `submitted_at` que la cola le mostró a la
  admin. Si la persona volvió a mandar los documentos después, **409 «La
  persona volvió a mandar los documentos. Revisalos de nuevo.»** y la cola
  se recarga con el envío nuevo. Sin ese dato (un cliente viejo) se decide
  sobre el envío pendiente, como antes, pero igual con el guardado
  condicional.
- Un reenvío que choca con una decisión relee y reintenta (hasta 3 veces;
  si pierde las 3, 409 «No pudimos guardar tu envío porque cambió mientras
  tanto. Probá de nuevo.» sin tocar nada). Si lo que entró fue una
  aprobación, 409 «Tu identidad ya está verificada» (o «Tu comercio ya está
  verificado»), y los archivos de ese envío, que ya estaban subidos y nada
  apunta, van a la cola de borrado (lo mismo si alguien ya verificado
  reenvía). Con el 409 no corre el borrado de después de responder: los
  borra el scheduler en su próxima pasada.
- `scripts/privatize_identity_evidence.py` cambia el puntero de las
  evidencias pendientes (de la URL pública, o de `file_delivery_type`
  `private`, a `authenticated`) sin mover el estado ni `submitted_at`, así
  que el guardado condicional del pedido no lo ve. Una decisión o un
  reenvío mientras corre el script trabaja con lo que leyó antes: encola el
  borrado con el tipo viejo (o, con la URL pública, no encola nada),
  Cloudinary contesta que ese archivo no existe, el pedido cuenta como
  borrado y el archivo `authenticated` queda huérfano hasta volver a correr
  el script (su paso 2 borra lo que nada apunta). Por eso el script se
  corre **sin pedidos abiertos** (decidir antes los pendientes de
  `/admin/verificacion` y no aprobar ni rechazar mientras corre) y **se
  vuelve a correr al terminar** (es idempotente). Está en
  `PENDIENTE_OPERATIVO.md`, ítem 5c.

