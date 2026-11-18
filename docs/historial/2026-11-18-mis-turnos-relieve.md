# Mis turnos con la dirección «con relieve» (beta, etapa 4)

**Pedido:** Julieta, 2026-11-18: «mergeá Candidatos cuando cierre en verde y
seguí con Mis turnos». Es la última pantalla del orden de
`docs/design-system/direccion-relieve.md`, sobre la segunda prueba de la app
(https://claude.ai/artifact/MEN8VhUv43HM2sE9pH6kmF).

**Qué cambió:** la pantalla de quien trabaja con sus turnos (`/my-shifts`,
titulada «Matches»). La lógica es la misma: las tres pestañas, las acciones
de cada turno («Llegué», «Voy en camino», cancelar, comparar guardados) y
sus avisos.

- **El encabezado va sobre la banda azul hondo**, con «Matches» en brocha y la
  bajada en la tinta de la banda.
- **Cada turno es una comanda de papel** en las tres pestañas (asignados,
  postulaciones y guardados): el puesto en brocha, el local y el barrio, el
  pago y el estado como sello de goma. Los terminados pierden el relieve.
- **En guardados**, el círculo de «Comparar» pasó afuera de la esquina del
  papel: adentro tapaba el sello «Urgente».

Técnico: `app/my-shifts/page.tsx` pasa `comanda` a `ShiftCard` (la pieza ya
estaba, del Panel) y pone `LETRAS_APP` en su contenedor; en `globals.css`,
`.letra-cartel-sobre-banda` (un título en brocha directo sobre la banda; no
es `.app-banda .letra-cartel` porque le pegaría al puesto de las comandas del
riel del Panel). Spec nuevo: `mis-turnos-relieve.spec.ts`.

**Por qué así:**

- **El encabezado y no la lista va sobre la banda.** En la prueba la comanda
  se montaba sobre el borde de la banda, pero acá entre el título y los
  turnos van las pestañas; montar la comanda las tapaba.
- **Lo hecho no se tacha a mano todavía.** En la prueba los pasos
  (confirmado, salí, llegué, terminé) se tachaban. Los pasos son
  `ShiftLifecycleStepper`, que comparten el Panel, el detalle y el admin:
  cambiarlo es su propio PR.

**Revisión independiente** (otro agente; 320 a 1280 px, claro y oscuro, las
tres pestañas, comparar, «Voy en camino», calificar): aprobado con arreglos
menores, hechos acá. El círculo de «Comparar» sin elegir no se veía sobre el
lienzo oscuro (ahora lleva borde azul); «Terminados» daba 3,5 de contraste
(pasa a `ink-soft`); cada pestaña tiene su h2 oculto para que no salte del h1
a los h3 de las comandas; y el anillo del turno resaltado (`?turno=`) va
despegado del papel. Anotó que el sello «Confirmado» en el papel de noche da
4,49 (el mínimo es 4,5): queda para el PR que revise los colores de los
sellos, porque lo comparten el Panel y Mis turnos.

**Queda abierto:** con esto termina el orden de pantallas de la etapa 4. Lo
que es de toda la app sigue en PRs propios: la barra de navegación, las
pestañas (`SegmentedControl`), los botones secundarios y los pasos tachados
a mano. El detalle del turno (`ShiftDetail`) tampoco migró.
