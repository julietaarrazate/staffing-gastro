# Privacidad: cuánto guardamos avisos y sesiones, y qué pasa de verdad con el DNI

**Pedido:** Julieta aprobó sumar a `/privacidad` las reglas de retención que
ahora aplica el scheduler
([`2026-10-23-indices-y-retencion.md`](./2026-10-23-indices-y-retencion.md))
y alinear lo que dice de los documentos de identidad con lo que hace el
código ([`2026-10-23-documentos-privados.md`](./2026-10-23-documentos-privados.md)).

**Qué cambió:** en `/privacidad`, "Cuánto tiempo los guardamos" suma dos
renglones:

- **Avisos dentro de la app:** los leídos se borran cuando cumplen 90 días;
  los no leídos se guardan mientras la cuenta esté activa
  (`READ_NOTIFICATION_RETENTION`, `NotificationRepository.delete_read_before`).
- **Sesiones iniciadas:** el registro de cada sesión se borra 7 días después
  de vencer. Si la persona cierra sesión antes, el registro queda marcado
  como cerrado hasta entonces, para detectar el reuso de un token (ADR-0002;
  `REFRESH_SESSION_RETENTION`, `delete_expired_before`). El registro guarda
  cuándo empezó y cuándo vence, sin IP ni dispositivo
  (`RefreshSessionModel`).

Documentos de verificación (DNI, selfie, constancia de AFIP): la página
decía en cuatro lugares que **se borran** al decidir, y `/terminos` lo
repetía. El código no borra el archivo: al aprobar o rechazar purga la
referencia en la base (`Evidence.purge_data`), y el archivo queda privado en
Cloudinary. Ese borrado figura como pendiente en la entrada de documentos
privados. Ahora las dos páginas dicen lo que pasa: se guardan privados, sin
link público; quien revisa los ve con un link que vence a los pocos
minutos; después de la decisión ya no se pueden abrir desde la app; el
archivo queda privado en Cloudinary, y se puede pedir que lo borremos.

Técnico: `frontend/app/privacidad/page.tsx`, `frontend/app/terminos/page.tsx`
y `LEGAL_TERMS_VERSION` de `2026-10-19-2` a `2026-10-23`, en
`backend/app/modules/identity/domain/value_objects.py` y en
`frontend/lib/legal.ts` (`lib/legal.test.ts` exige que coincidan).
"Última actualización: octubre 2026" no cambia.

**Qué hace la versión nueva con la gente que ya tiene cuenta:** nada
automático. La versión sólo se graba en `terms_acceptances` cuando alguien
crea una cuenta (`IdentityService`, canal email o Google). No hay pantalla
de re-aceptación ni aviso dentro de la app: las cuentas existentes conservan
su fila con la versión que aceptaron y las nuevas graban `2026-10-23`. La
política promete avisar en la app con 15 días de anticipación "si cambiamos
algo importante". Decidir si esto cuenta como importante y si hace falta
avisar queda para Julieta.

**Por qué así:** la página tiene que describir lo que el código hace hoy, no
lo que se planea. Se descartó dejar el "se borran" hasta implementar el
borrado en Cloudinary: la versión nueva habría seguido prometiendo algo
falso. Cuando ese borrado exista, el texto puede volver a decir "se borran"
con otra versión.

**Queda abierto:**
- "Sin link público" vale para lo subido desde #494. Lo anterior sigue con
  URL pública hasta que se corra `scripts/privatize_identity_evidence.py`
  en producción (pendiente de Julieta, junto con `CLOUDINARY_CLOUD_NAME` en
  Render). Conviene correrlo antes de mergear esto.
- Borrar el archivo de Cloudinary al aprobar o rechazar. Las tarjetas de
  verificación del trabajador y del comercio
  (`IdentityVerificationCard.tsx`, `BusinessVerificationCard.tsx`) siguen
  diciendo "las eliminamos una vez revisadas". No se tocaron acá: hay que
  implementar el borrado o cambiar ese texto.
