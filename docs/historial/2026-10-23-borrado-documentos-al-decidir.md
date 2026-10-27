# Los documentos de verificación se borran de Cloudinary al decidir (#507)

**Pedido:** Julieta decidió que el DNI (frente y dorso), la selfie y la
constancia de AFIP se borren de Cloudinary apenas la verificación se aprueba o
rechaza. La política de privacidad ya lo prometía; la app sólo borraba el
puntero en la base y el archivo quedaba guardado (privado desde ADR-0021).

**Qué cambió:** para la persona, nada visible: "las eliminamos una vez
revisadas" y "No guardamos tu DNI" (tarjetas de verificación) ahora son
exactos. Por dentro (ADR-0021, sección «Borrado al decidir»):

- Al decidir, el puntero sale de la evidencia como antes y, **en el mismo
  commit**, queda en una cola nueva, `identity_evidence_file_deletions`
  (migración `0043`). Dominio: `Claim.files_to_delete` y
  `EvidenceFileDeletion` (`backend/app/modules/verification/domain/entities.py`);
  puertos `EvidenceFileDeletionRepository` y `EvidenceFileStorage`.
- Después de responder, una `BackgroundTask` con sesión propia borra cada
  archivo con `destroy` de la Upload API (`type=private`, `invalidate=true`):
  `verification/infrastructure/evidence_file_storage.py` y
  `file_cleanup_job.py`; caso de uso `EvidenceFileCleaner`. La decisión no
  espera a Cloudinary ni falla por él.
- Recién cuando Cloudinary confirma (`ok` o `not found`) se borra la fila de
  la cola. Si falla, la fila queda con el error y la hora del reintento
  (15 min, 30 min, 1 h… hasta una vez por día); el scheduler lo reintenta
  con un chequeo nuevo que entra por `extra_checks` desde `app/main.py`.
- Un reenvío estando pendiente también manda a borrar lo que reemplaza.
- `scripts/privatize_identity_evidence.py`: el paso 2 ya no pasa a privados
  los huérfanos de `oido/identidad/` y `oido/constancias/`: los **borra**.
  Nunca toca un archivo que apunte una evidencia ni uno subido hace menos de
  24 h. Sigue en dry-run por defecto, `--apply` para hacerlo, idempotente.
- `sessions_like` (sesiones nuevas sobre el engine del request) pasó de
  `notification/infrastructure/repositories.py` a `app/core/database.py`:
  la usan los push y ahora el borrado.

**Por qué así:** se descartó dejar el puntero en la evidencia marcado
"pendiente de borrar" hasta que Cloudinary confirme: un trabajador rechazado
que reenvía antes de esa confirmación pisa sus evidencias y la referencia se
perdía. La cola aparte no cuelga del claim (sin FK), así que sobrevive a un
reenvío y a un claim borrado. El chequeo entra al scheduler por inyección
porque el candado de capas no deja que `shift/application/scheduler.py`
importe otra infraestructura más. Un HTTP 404 de Cloudinary **no** cuenta
como borrado: también lo devuelve un `cloud_name` que no existe. Los
reintentos se espacian por la cuota de Neon (cada uno despierta la base).

**Queda abierto:** Julieta tiene que cargar `CLOUDINARY_CLOUD_NAME` en Render
(sin ella no se borra nada; queda en la cola) y correr el script con
`--apply` (comando en `reference/PENDIENTE_OPERATIVO.md`, ítem 5b). Las
subidas que nunca se envían quedan hasta que se vuelva a correr el script.
No se tocaron `/privacidad`, `/terminos` ni `LEGAL_TERMS_VERSION` (PR aparte
de Julieta).
