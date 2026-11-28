# La app habla con la voz de Oído: avisos, vacíos y mails (#767)

**Pedido:** Julieta, 2026-11-28: aplicar los textos de la revisión de voz
(documento privado de crecimiento, pestaña «Voz y firma», sección 2) según la
decisión anotada ahí mismo: los diez antes y después, los cinco de una línea y
el pinche en los vacíos de turnos. La cinta «¡Oído!» y lo de «No se tocan»
quedan como estaban. Capturas en claro y oscuro antes del merge.

**Qué cambió:**

- Avisos (campanita y push): «Te eligieron para Bartender» / «Bar Palermo Soho
  te eligió para el lunes 30/11 a las 21:00. Falta que digas «¡oído!»:
  confirmá que vas.»; al comercio, «¡Oído! Ana Pérez confirmó» y «Ana Pérez
  terminó el turno» (con el nombre, como los demás avisos al comercio); el de
  turno nuevo cerca da puesto, cuándo, paga y horas («Mozo/a el domingo 29/11
  a las 19:00, cerca tuyo» / «Bar Palermo Soho paga $42.000 por 6 horas. Si
  te sirve, postulate.»); «Te calificaron por un turno que ya cerró».
  `backend/app/modules/shift/application/services.py`,
  `backend/app/modules/review/application/services.py`.
- Mails: asunto «Te eligieron: … Falta que confirmes»; la bienvenida de quien
  trabaja («Ya estás en Oído: 3 cosas para que te lleguen turnos», «Ya estás
  adentro», cierre «Nos vemos en el turno. Oído»). La del comercio no cambió.
  `backend/app/modules/identity/application/services.py`,
  `backend/app/modules/notification/domain/email_templates.py`.
- Pantallas: «Postulación enviada a {local}. Te avisamos apenas responda.» en
  las cinco pantallas donde se postula (`postulacionEnviada` en
  `frontend/lib/applications.ts`); vacíos nuevos de Mis turnos, Chats y
  Favoritos; el pinche (el ícono por defecto de `EmptyState`) en los vacíos de
  Mis turnos, Chats y los dos de Candidatos; «Avisos» en lugar de
  «Notificaciones» en la campanita; bajadas de Buscar, Chats y Candidatos.
- Las reglas de voz de la app quedan en `docs/design-system/voz.md`.

**Por qué así:** los avisos dicen el día con fecha («el domingo 29/11 a las
19:00») y no «mañana», como los ejemplos del documento: quedan en la
campanita y leídos al otro día dirían otro día (lo vio la revisión
independiente). El aviso «confirmó» decía «Te avisamos cuando salga para
allá», pero «Va en camino» lo prende la persona y nunca arranca solo: quedó
«Si avisa que sale para allá, te llega otro aviso», para no prometer lo que
depende de otro. Con «Avisos», el botón de la campanita también se anuncia así
a los lectores de pantalla; «Notificaciones push» (el interruptor del sistema)
y Privacidad no se tocaron. La landing tampoco: sus réplicas de avisos siguen
con los textos de antes (la landing queda como está).

**Queda abierto:** los dos usos nuevos de la cinta «¡Oído!» (al confirmar y en
el mail «Te eligieron»), que cambian la regla 3 de `marca-hoy.md`; mirar los
mails en una casilla real de Gmail y de Outlook. Visto en la prueba en la app
y anterior a este cambio: en el detalle del turno, durante unos 300 ms después
de tocar «Postularme», la página se ensancha a 478 px (algo de la animación de
confirmación desborda) y el aviso aparece corrido a la derecha hasta que se
acomoda. El rótulo del mail «Te eligieron» todavía dice «TURNO ASIGNADO».
