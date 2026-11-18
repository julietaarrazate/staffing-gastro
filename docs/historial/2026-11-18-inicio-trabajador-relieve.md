# El Inicio del trabajador con la dirección «con relieve» (beta, etapa 4)

**Pedido:** Julieta, 2026-11-18, con la landing híbrida ya publicada:
«seguimos con la app, pantalla por pantalla». Es la primera pantalla del
orden de `docs/design-system/direccion-relieve.md`, sobre la segunda prueba
de la app (https://claude.ai/artifact/MEN8VhUv43HM2sE9pH6kmF).

**Qué cambió:** el Inicio de quien trabaja (`/feed`), en el celular. La
lógica es la misma: qué turnos se piden, cómo se ordenan, qué pasa al tocar
cada cosa.

- **Arriba, el cielo:** celeste pleno con dos nubes de día, azul noche de
  noche. Encima, «Hola, Sofía» en brocha, la zona debajo a todo el ancho y el
  buscador, ahora recto y sin sombra.
- **«Disponible» es el cartelito de la puerta:** verde como el de «abierto»,
  blanco cuando no, colgado de su hilo; se da vuelta al tocarlo.
- **El turno recomendado es una comanda de papel**, montada sobre el borde
  del cielo y con el relieve del filete: el puesto en brocha, el local, y dos
  renglones con filete (cuándo y pago). La foto del local sigue, chica, al
  lado del puesto. Si el turno es urgente lleva el sello «Urgente»; si es
  para hoy, el apunte a mano «para hoy». El título de la sección, «Para vos»,
  reemplaza a la insignia «Recomendado».
- **«Cerca tuyo» es una lista** con filete fino: foto o ícono del rubro,
  puesto, dónde y cuándo, y la paga a la derecha. Antes eran miniaturas en
  scroll horizontal.
- **«Descubrir rápido»** queda plano, con filete: el relieve de la pantalla
  es la comanda.

Técnico: piezas compartidas para las próximas pantallas. `frontend/lib/letras.ts`
(la brocha y Mansalva; cada pantalla migrada pone `LETRAS_APP` en su
contenedor, así las demás no las bajan), `components/ui/Comanda.tsx`
(`Comanda`, `ComandaFila`, `Apunte`, `textoCartel`) y, en `globals.css`,
`.letra-cartel`, `.letra-mano`, `.apunte`, `.sello-goma`, `.app-cielo`,
`.comanda*` y `.cartelito*`, con sus tokens (`--app-cielo-*`,
`--color-cartel`, `--comanda-papel`). Se tocaron `app/feed/page.tsx`,
`components/worker/FeedHero.tsx`, `NearbyRow.tsx`, `LocationBar.tsx` y
`components/AIAssistantBar.tsx` (prop `recto`; el panel del comercio sigue
con la píldora hasta que migre).

**Por qué así:**

- **El papel es papel en los dos temas.** Adentro la comanda va forzada a
  claro, así la tinta, los filetes, el sello de confianza y el botón de
  guardar se ven igual de día y de noche; en oscuro el papel baja un punto
  (`#eef3f6`) y el relieve sigue al tema.
- **La barra de «Mozo/a».** Dibujada con la brocha se lee como una letra
  («MOZOIA», visto en la landing). `textoCartel` la separa y va en Inter
  fina; el puesto sigue en brocha, como en la prueba.
- **Los avisos en su renglón.** «para hoy» y «Urgente» iban al lado del
  puesto y a 390 px se le encimaban: comparten renglón con «Comercio
  verificado».
- **La zona, a todo el ancho.** Al lado del cartelito se partía en dos
  renglones. Sobre el cielo hereda la tinta del cielo y lo que se toca va
  subrayado: el azul de los links no llega a contraste sobre el celeste.
- **En escritorio el cielo es un panel** y la grilla va debajo, sin
  montarse. Las tarjetas de esa grilla (`OpportunityCard`, que también usa
  «Descubrir rápido») no se tocaron: son otra pieza.

**Revisión independiente** (otro agente; de 320 a 1280 px, en claro y
oscuro, con teclado, con «reducir movimiento» y en los estados cargando,
error, vacío y sin perfil): aprobado con arreglos menores, hechos acá.

- A 320 px un nombre largo se partía por la mitad («MAXIMILIAN / O»): el
  saludo ya no se parte dentro de una palabra, y si no entra al lado del
  cartelito, el cartelito baja a su renglón.
- De noche, el anillo de foco de la comanda caía sobre el cielo con el azul
  de claro y no llegaba a 3:1: ahora va por dentro del papel.
- En «Cerca tuyo», con «Urgente» al lado, el puesto se cortaba («Ayudante
  …»): «Urgente» pasó al renglón del horario y nada se corta.
- Cargando, con error o vacío, el esqueleto y el dibujo del vacío quedaban
  cortados por el borde del cielo: ahí ya no se monta nada (`seMonta`).
- El punto entre la zona y «Estoy acá» quedaba colgando a 320 px: se fue.

Anotó además que el nombre accesible del cartelito («Cambiar
disponibilidad») no incluye el texto que se ve («Disponible»); ya era así con
el interruptor anterior y `aria-pressed` dice el estado. No se tocó.

**Queda abierto:** el Panel del comercio, Candidatos y Mis turnos (ítem 0 de
`STATUS.md`). La barra de abajo «pegada al borde, con una raya azul hondo»
de la prueba es de toda la app y va en su propio PR. `OpportunityCard` y el
detalle del turno siguen con el diseño anterior.
