# Los pasos del turno, tachados a mano (beta, etapa 4)

**Pedido:** Julieta, 2026-11-19: los pasos tachados a mano de la segunda
prueba de la app (https://claude.ai/artifact/MEN8VhUv43HM2sE9pH6kmF: «lo hecho
se tacha a mano, como en el pase»). En la prueba eran renglones con casilleros;
se le preguntó cómo llevarlo a las comandas, donde hay muchas juntas, y eligió
**en un renglón**: las cuatro palabras una al lado de la otra.

**Qué cambió:** el indicador de pasos de cada turno (`ShiftLifecycleStepper`,
dentro de `ShiftCard`), en el Panel y en Mis turnos (y en la landing vieja de
`/historia`, que usa la misma tarjeta). La
lógica es la misma: los cuatro hitos («Publicado, Asignado, En curso,
Finalizado» para el comercio; «Postulado, Aceptado, En curso, Finalizado» para
quien trabaja), en qué paso cae cada estado y dónde se cortó un turno
cancelado o no cubierto.

- **Lo hecho, tachado a mano** con un trazo de birome en azul hondo (celeste
  de noche fuera del papel), un poco más ancho que la palabra.
- **Lo actual, en negrita** y en tinta. **Lo que falta**, en la letra suave.
- **Cancelado:** el paso donde se cortó va en rojo con una cruz; los que
  seguían quedan sin tachar, porque no pasaron. Abajo sigue «Cancelado en el
  paso 2 de 4 (Asignado)». **No cubierto:** igual, con un reloj y sin rojo.
- Antes eran cuatro circulitos numerados unidos por una línea.
- **Si no entran al lado del sello**, los pasos bajan enteros al renglón de
  abajo (antes se apretaban al lado); a 320 px «Finalizado» pasa a un segundo
  renglón.

Contraste (calculado con los colores de los tokens; el spec lo mide
renderizado y exige 4,5 en cada palabra):

| | Papel claro | Papel de noche (`#eef3f6`) | Tarjeta de noche (fuera del papel) |
|---|---|---|---|
| Lo hecho y lo que falta | 7,6 | 6,8 | 8,2 |
| Lo actual | 18,9 | 16,9 | 15,2 |
| Donde se canceló | 5,6 | 5,0 | 6,1 |
| El trazo | 8,1 | 7,3 | 9,6 |

Técnico: `components/ShiftLifecycleStepper.tsx` (una `ol` con `role="list"`,
cada paso con `data-paso` y `aria-current="step"` en el actual; lo hecho suma
«(hecho)» para lectores de pantalla), `.pasos-tachados .tacha` en
`globals.css` y la fila de `ShiftCard.tsx`, que ahora se parte. Se
actualizaron los specs que miraban los circulitos
(`shift-lifecycle-stepper.spec.ts`: el trazo, la negrita y el contraste en
los dos temas; `matches-grupo-h.spec.ts`: el paso actual no va en ámbar).

**Por qué así:**

- **En un renglón y no en lista:** en el Panel cada comanda habría crecido unos
  100 px. La lista de la prueba se pensó para un turno solo.
- **Los nombres no cambiaron:** la prueba decía «Confirmado, Salí, Llegué,
  Terminé». Cambiarlos movería qué estado cae en qué paso, y eso es lógica.
- **Sin animar el trazo:** al cargar una lista se habrían dibujado todos a la
  vez.

**Revisión independiente** (otro agente; Panel y Mis turnos, las dos
perspectivas, claro y oscuro, 320, 390 y 1280, con los once estados más
cancelado con y sin check-in y no cubierto con y sin trabajador): aprobada.
Comprobó que cada estado cae en el mismo paso que antes, que el trazo
sobresale 3 px de cada lado sin tocar la palabra vecina, que nada desborda ni
se parte una palabra, y el contraste de cada palabra en el navegador (lo
mismo que la tabla de arriba; con el `saturate(.8)` de las comandas apagadas
sigue arriba de 5,7). Anotó que a 320 px, en cancelado y no cubierto, la
lista ocupa dos renglones debajo del sello («Finalizado» solo abajo): se
parte entre palabras, nunca adentro de una, y se lee. También, fuera de este
cambio, que en Mis turnos el sello dice el estado del turno («Asignado») y el
paso dice «Aceptado»: ya era así.

**Queda abierto:** los colores de los sellos y el detalle del turno (ítem 0
de `STATUS.md`).
