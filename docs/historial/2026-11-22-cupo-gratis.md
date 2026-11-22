# Cupo gratis por defecto y Zernio para los mensajes automáticos (#733)

**Pedido:** Julieta: «siempre usamos el cupo free, no nos pasamos de eso, ojo
con las apis»; que ninguna integración pueda traer un cargo sorpresa cuando
lleguen usuarios reales. Y dejar elegida la herramienta de comentario →
mensaje privado.

**Qué cambió:** sólo documentos.

- [ADR-0030](../adr/ADR-0030-cupo-gratis-y-topes-de-gasto.md): plan gratis por
  defecto, mejor que corte a que cobre, tope propio debajo del cupo en toda API
  externa, e inventario de los servicios con qué pasa al pasarse y qué falta
  verificar.
- `CLAUDE.md` («No hacer») y `STATUS.md` («Decisiones vigentes») con la regla;
  en «Pendiente de Julieta», la cuenta de Zernio y la revisión de facturación.
- Herramienta elegida: Zernio (gratis para las 2 cuentas, 2.000 respuestas
  automáticas por mes; sin tarjeta se pausa al llegar). ManyChat descartado
  (25 contactos por mes gratis). Mensajes en la sección Embudo del documento
  de crecimiento.

**Por qué así:** el riesgo real son los servicios que cobran el excedente
(Gemini con facturación activa en Google, Zernio con tarjeta, GitHub o Sentry
con límite de gasto mayor a 0). Los que cortan (Neon, Vercel Hobby, Resend)
sólo dejan de funcionar. Verificado con las herramientas de la sesión: Neon
en plan gratis. Render no se pudo mirar (pide elegir el espacio de trabajo).

**Queda abierto:** la revisión de facturación de Julieta (lista en
`STATUS.md`) y una vista de consumo de topes en `/admin/metricas`.
