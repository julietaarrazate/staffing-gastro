# «Publicar turno» y «Publicar evento» con la dirección suave (beta, etapa 4)

**Pedido:** Julieta, 2026-11-19: «cuando ponés publicar turno o evento y se
despliega para cargar la publicación sigue teniendo la estética vieja; hay
que terminar de pulir esas pantallas». Se le mostraron, sobre la pantalla
real, varias versiones de la dirección «con relieve»: sin cielo y con cielo;
el pedido como comanda colgada del riel, con los renglones alineados; los
puestos en pizarra, en carta y en fichas rectas; controles con filete azul y
relieve chico; casilla recta o interruptor recto. No la convencieron: «está
todo plano, del mismo tono o de un tono apenas distinto, termina mareando»,
«la brocha es un exceso para lo que no es título», «muy duro». Mandó cuatro
referencias (color atrás, superficies claras adelante, sombras difusas,
títulos grandes en sans) y con eso se armó **la hoja sobre el cielo**. La
ablandó dos veces y eligió el título en letra normal: «dale, seguí así».
Queda como dirección nueva de la app en el
[ADR-0028](../adr/ADR-0028-direccion-suave.md).

**Qué cambió** (sin tocar la lógica: qué se pide, qué se valida, qué se
manda y a dónde lleva):

- **Arriba, el cielo** con la vuelta en un botón redondo de vidrio, los pasos
  con palabras tachando lo hecho («Puesto · Cuándo · Pago · Publicar»; antes,
  barritas en ámbar) y la pregunta del paso en letra normal grande y negrita
  (antes, serif adentro del paso).
- **Debajo, una hoja blanca** que sube sobre el cielo con el paso.
- **Los puestos son teclas** blancas con sombra suave, sin íconos (Julieta:
  «muy genéricos»); el elegido, lleno de azul hondo.
- **Propinas, comida y urgente:** la fila es una tecla y el estado una
  casilla redonda que se llena de azul hondo con el tilde (antes, un
  interruptor redondeado en verde).
- **Los campos** van con relleno suave y sin borde; la ayuda de la IA
  («Describilo y lo completamos») en celeste, y «Completar» liso: el único
  ámbar es «Continuar» / «Publicar turno», ahora en degradé con sombra de su
  color.
- **El pedido del último paso es la tarjeta del turno**: el cielo con el
  puesto y los datos en chips (el día, el horario con la duración, dónde) y
  abajo el pago bien grande con los extras. En la compu, la vista previa del
  costado es la misma tarjeta y se va llenando.
- **«Publicar evento»**: el mismo cielo con el título, la hoja con el
  formulario, cada rol en una tarjeta suave.

Técnico: `.estilo-suave` en la raíz de `app/shifts/new/page.tsx` y
`app/shifts/new-event/page.tsx`; clases y tokens nuevos al final de
`app/globals.css` (`.hoja`, `.titulo-pantalla`, `.boton-vidrio`, `.tecla`,
`.casilla`, `.campo`, `.tarjeta-suave`, `.nota-ayuda`, `.pedido-tarjeta`,
`.chip-vidrio`, `.chip-suave`); ganchos en `ui/Button` (`boton`),
`ui/TextField` (`campo`) y `ui/Toggle` (`tecla`, `casilla`, `interruptor`),
que fuera de `.estilo-suave` se ven como antes. Componentes nuevos:
`components/PedidoTarjeta.tsx` y `ui/PasosTachados.tsx` (que ahora usa
también la bienvenida en lugar de su `StepDots`). Spec nuevo:
`e2e/publicar-suave.spec.ts`.

**Revisión independiente** (320, 390 y 1280, claro y oscuro): aprobada, sin
bloqueantes. Se corrigió lo que marcó:
- el borde de la casilla sin marcar (2,1 → 3,8);
- «Así lo van a ver» (3,6 → la tinta del cielo);
- el chip «Urgente» (4,3 → un rojo más hondo);
- los textos de ejemplo de los campos, en `ink-soft`;
- los chips vacíos de la vista previa, sin transparencia;
- las sombras que se cortaban contra la caja del paso;
- de noche, la tarjeta del pedido, que se fundía con la hoja;
- el lugar de la vista previa, que ahora es el mismo que en el último paso;
- el cuadro de la IA, con un renglón más a 320.

Fuera de estas pantallas no cambió nada: medido en el perfil, el ingreso y la
bienvenida.

**Por qué así:**

- **De a una pantalla y sin mezclar dentro de una:** cambiar el botón, el
  campo y el sí/no en toda la app de golpe habría dejado un botón suave al
  lado de comandas y fichas rectas en las pantallas no migradas. Con la
  clase raíz, cada pantalla es coherente y el resto queda como estaba hasta
  su PR (el orden está en `design-system/direccion-relieve.md`).
- **La hoja «¡Turno publicado!»** es compartida con el Panel: se migra con
  las hojas, en el PR de lo compartido.
