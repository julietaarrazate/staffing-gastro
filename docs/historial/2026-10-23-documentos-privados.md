# Documentos de identidad privados en Cloudinary, con link que vence

**Pedido:** Julieta aprobó el arreglo del ítem "Media — documentos de
identidad en Cloudinary con entrega pública" de la revisión de seguridad del
2026-10-20: subirlos privados y que el panel de admin pida un link que vence.

**Qué cambió:** para el trabajador y el comercio, nada en el flujo: suben el
DNI, la selfie o la constancia igual que antes; el texto ahora dice que
quedan privadas. La vista previa del DNI sale del archivo del teléfono (el
archivo subido ya no tiene URL pública). En el panel de Verificación, cada
evidencia se ve con un link que vence a los 5 minutos; si se abre más tarde,
se pide otro en el momento.

Técnico (ADR-0021):
- `backend/app/core/cloudinary.py`: `type=private` firmado en la subida de
  identidad y constancia; `private_download_url` (API de descarga con
  `expires_at`) y `signed_api_params`. Nueva variable
  `CLOUDINARY_CLOUD_NAME` (`settings.cloudinary_cloud_name`).
- `backend/app/modules/verification/`: `EvidenceFile` (referencia privada),
  `Evidence.file`, puerto `EvidenceLinkSigner` con adaptador Cloudinary,
  `VerificationService.evidence_link`, `GET /identity/evidences/{id}/link`
  (admin; 404 si no existe, se purgó o el claim ya se decidió). La cola y el
  envío ya no llevan URLs. Migración `0039` (columnas `file_*`).
- `backend/scripts/privatize_identity_evidence.py`: pasa a privados los
  archivos ya subidos (`rename` con `to_type=private`) y actualiza la base.
  Dry-run por defecto, idempotente. **No se corrió contra producción.**
- `frontend/lib/cloudinary.ts` (`uploadIdentityImage`, `uploadBusinessDocument`
  devuelven la referencia), `components/worker/IdentityVerificationCard.tsx`,
  `components/company/BusinessVerificationCard.tsx`,
  `components/admin/IdentityReviewQueue.tsx`, `lib/identity.ts`.
- Tests: `backend/tests/test_evidencias_privadas.py` (firma, link, schemas,
  endpoint, script con un Cloudinary de mentira y con `httpx.MockTransport`),
  `frontend/lib/identity.test.ts`, `lib/cloudinary.test.ts`,
  `components/admin/IdentityReviewQueue.test.tsx`,
  `e2e/verificacion-privada.spec.ts`.

**Por qué así:** el link con vencimiento sobre `res.cloudinary.com`
(token-based auth) es de los planes pagos; la URL firmada de un recurso
`authenticated` no vence. La API de descarga privada sí vence y anda en el
plan gratis. Detalle y fuentes en el ADR-0021. No se pudo abrir
cloudinary.com desde la sesión: los parámetros se confirmaron leyendo el SDK
oficial de Python (`cloudinary` 1.46.3).

**Queda abierto:** (en `../STATUS.md`, "Pendiente de Julieta")
- Cargar `CLOUDINARY_CLOUD_NAME` en Render y correr el script (pasos en el
  ADR, "Migración").
- Borrar el archivo de Cloudinary al aprobar/rechazar: hoy queda guardado
  (privado) aunque la app dice "las eliminamos una vez revisadas".
