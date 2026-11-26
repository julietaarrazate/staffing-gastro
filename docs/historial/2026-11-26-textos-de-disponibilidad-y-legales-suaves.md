# Textos de disponibilidad y las páginas legales con el diseño de la app (#PR)

**Pedido:** Julieta (2026-11-26), con la respuesta de su consulta legal: la
reconfirmación no se plantea como control del trabajador sino como una
actualización de disponibilidad. Y vio que `/terminos` había quedado con la
estética anterior.

**Qué cambió:**
- La reconfirmación (sigue apagada) pregunta «¿Seguís disponible para este
  turno?», con «Sí, sigo disponible» y «Ya no estoy disponible»; al comercio
  le llega «Todavía no hay respuesta de Camila» y el Panel dice «confirmó que
  sigue disponible» o «todavía no respondió». El cartel de cancelar dice lo
  que pasa de verdad: «no suma a tus cancelaciones» o «suma a las
  cancelaciones que los comercios ven en tu perfil». Los textos están al final
  del ADR-0031.
- Puntualidad real: el aviso a la persona cuando el comercio marca su
  llegada dice «el comercio indicó que llegaste…», y la pregunta al comercio
  aclara que se le avisa.
- `/terminos` y `/privacidad` usan el diseño de la app: el cielo corto con la
  vuelta y el título, y el texto en la hoja, con el índice lateral en la
  compu (`frontend/components/legal/PaginaLegal.tsx`). El texto no cambió:
  no sube la versión legal.

**Por qué así:** se descartaron dos frases de la propuesta legal. «Indicador
de cumplimiento» no existe en la app (lo que se ve en el perfil son
«cancelaciones»), y «quedará registrada según los criterios informados en los
Términos» no le dice a la persona qué le va a pasar.

**Queda abierto:** nada.
