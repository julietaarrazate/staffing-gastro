# Privacidad: cuánto guardamos los avisos y las sesiones

**Pedido:** Julieta aprobó sumar a `/privacidad` las reglas de retención que
ahora aplica el scheduler
([`2026-10-23-indices-y-retencion.md`](./2026-10-23-indices-y-retencion.md)).

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

En "Seguridad", los documentos de verificación ahora dicen que se guardan
privados y que quien los revisa los ve con un link que vence a los pocos
minutos (ADR-0021), antes de borrarse.

Técnico: `frontend/app/privacidad/page.tsx` y `LEGAL_TERMS_VERSION` de
`2026-10-23` a `2026-10-23-2`, en
`backend/app/modules/identity/domain/value_objects.py` y en
`frontend/lib/legal.ts` (`lib/legal.test.ts` exige que coincidan).
"Última actualización: octubre 2026" no cambia.

**Por qué así:** la primera versión de este PR cambiaba el "se borran" del
DNI, la selfie y la constancia de AFIP por "quedan privados", porque el
código todavía no borraba el archivo de Cloudinary. Julieta decidió
borrarlos al decidir la verificación
([`2026-10-23-borrado-documentos-al-decidir.md`](./2026-10-23-borrado-documentos-al-decidir.md)),
así que la política conserva el "se borran" y este PR queda sólo con la
retención. Se usa el sufijo `-2` porque el cobro mensual (#497) ya publicó
`2026-10-23` con otro texto de `/terminos`: una misma versión no puede
nombrar dos textos.

**Qué hace la versión nueva con la gente que ya tiene cuenta:** nada
automático. La versión sólo se graba en `terms_acceptances` al crear una
cuenta; no hay re-aceptación ni aviso en la app. Son renglones informativos
sobre plazos más cortos, no un cambio de lo que se hace con los datos.

**Queda abierto:** nada.
