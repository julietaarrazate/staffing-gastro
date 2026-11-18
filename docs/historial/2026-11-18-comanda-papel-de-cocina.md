# La comanda de la landing es papel de cocina, no un ticket

**Pedido:** Julieta, 2026-11-18: con la letra y el isotipo ya elegidos,
arrancar a llevar la dirección «con relieve» al código en el orden de
`docs/design-system/direccion-relieve.md`. Esta es la primera pieza, y
cerraba un ítem de `STATUS.md` abierto desde el 2026-11-17: que la comanda
dejara de parecer un ticket de caja.

**Qué cambió:** en «Pedilo como lo dirías» el papel que sale de la impresora
tiene los datos en Inter (antes DM Mono), los renglones separados por un
filete liso (antes punteado) y el borde de abajo recto (antes en zigzag). Los
rótulos «Puesto», «Cuándo» y «Paga» van en minúscula. El texto, la lógica del
pedido y la animación no cambian. Todo está en `frontend/app/globals.css`:
`.landing-comanda`, `.landing-comanda-tope`, `.landing-comanda-fila` y
`.landing-falta`.

**Por qué así:** es la regla 5 de `docs/design-system/marca-hoy.md`. Al
sacar la máscara del zigzag apareció la sombra del papel recortada por su
marco (la máscara la tapaba), así que pasó de `filter: drop-shadow` a una
`box-shadow` que entra en el margen. La revisión independiente marcó dos
cosas que se arreglaron acá: «A coordinar» (`.landing-falta`) daba 2,5:1 de
contraste y pasó a `ink-mute`; y a 320 px «Sábado 20:00 – 03:00» se salía del
papel, así que de 360 px para abajo los renglones bajan a 13 px. Las volutas,
la orla y la guarda de colores quedaron como estaban.

**Queda abierto:** nada de esta pieza. Siguen los tokens del relieve, el
ícono «grito y respuesta», los precios como carta y los títulos con la letra
nueva (ítem 0 de `STATUS.md`).
