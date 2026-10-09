# Vidrio esmerilado, menos celeste y planes nuevos en la landing

**Pedido:** Julieta, 2026-10-09, en el hilo "Identidad de marca de Oído".
Con el ámbar de vuelta (#411) pidió sacar celeste donde estaba "demasiado
cargado", usar más el gris y el blanco, y sumar "efectos esmerilados como si
fuese gradiente". Mandó referencias: una app con degradé cálido arriba y
tarjetas blancas, vidrio sobre un degradé desenfocado, pares de color claro
con su versión profunda y una marca oscura con resplandor naranja y píldoras
de vidrio. También pidió cambiar los planes de la landing: "feo, muy básico".
Vio el prototipo en capturas y dijo que se mergee.

**Qué cambió:**
- `globals.css`: `--color-chrome` translúcido (encabezado y barra de abajo
  con `backdrop-blur-xl`), `--wash` en el fondo de `body` (velo ámbar arriba
  en claro, resplandor en la esquina en oscuro) y la utilidad `bg-glow`
  (blanco con brillo celeste y ámbar).
- `bg-glow` reemplaza al celeste lleno en la tarjeta destacada de Inicio
  (`FeedHero`), la cabecera del turno sin foto (`ShiftDetail`, sólo cuando el
  tono es la marca) y el encabezado del Perfil (`WorkerGameCard`).
- En oscuro la superficie de marca es celeste al 12% con letra clara, en vez
  de celeste lleno con tinta.
- `Carta.tsx`: los planes son tres tarjetas; el Básico destacado (`bg-glow`,
  el único botón ámbar) y cada plan dibuja su tope de turnos (un cuadradito
  por turno; Pro, una barra llena).

**Por qué así:** el celeste lleno en cinco lugares por pantalla competía con
el ámbar. Quedó lleno sólo donde decide algo (el pago, "Mejor valorado"). El
vidrio va en dos superficies y el brillo en una por pantalla, para no caer en
lo genérico que se descartó para la landing el 2026-10-06. Los planes eran
una lista de texto. Ahora la diferencia entre 3, 15 y sin tope se ve antes de
leerla.

**Queda abierto:** las burbujas 3D de las referencias quedaron fuera del día
a día de la app. Si se usan, irían en la landing o en una pantalla vacía.
