# Beta etapa 3, grupo I: subidas de archivos y perfil del trabajador

**Pedido:** Julieta, triaje de la beta (U051, U052, U091): un archivo que no es imagen abría el encuadre con una imagen rota, los errores de subida eran todos el mismo mensaje genérico, el CV no se podía reemplazar, «años de experiencia» no se vaciaba y «Rechazada» se leía poco.

**Qué cambió:**
- Nuevo `frontend/lib/upload-validation.ts`: un solo lugar con el límite (10MB), los formatos por tipo de subida (espejo de `ALLOWED_*_FORMATS` del backend) y los mensajes: «tipo no permitido» (con los formatos que sí) y «demasiado pesado» (con el límite real). `uploadSigned` (`lib/cloudinary.ts`) además traduce el `error.message` que devuelve Cloudinary.
- `CvUpload`, `BusinessVerificationCard` e `IdentityVerificationCard` validan antes de subir con ese helper (se sacaron los `MAX_*_MB` duplicados). `CvUpload` suma «Reemplazar» cuando ya hay CV.
- `ImageUpload` y `CoverPhotoUpload` rechazan lo que no es imagen antes de abrir el encuadre; `ImageCropModal` tiene `onError` y, si la imagen no carga, avisa y ofrece «Elegir otra» en vez del visor roto.
- `WorkerProfileForm`: «años de experiencia» es texto en el estado (se puede vaciar, sin ceros a la izquierda); vacío se guarda como 0 (el backend exige entero 0-80, no acepta null; no se tocó).
- «Rechazada» y los errores de subida usan `text-danger-text` (token con contraste en claro y oscuro) en lugar de `text-danger`.
- Tests: `upload-validation.test.ts`, `ImageCropModal.error.test.tsx`, ampliado `CvUpload.test.tsx`, E2E `subidas-errores.spec.ts`.

**Por qué así:** el chequeo local es comodidad, no seguridad (la firma del servidor manda); por eso la traducción del error de Cloudinary queda como red de seguridad. No se tocó qué documentos pide la verificación (frente y selfie, U109).

**Queda abierto:** nada de este grupo. HEIC pasa el chequeo de tipo pero Chrome/Firefox no lo dibujan: cae en el aviso del encuadre.
