# Los botones secundarios con la dirección «con relieve» (beta, etapa 4)

**Pedido:** Julieta, 2026-11-19: después de la barra de abajo y las pestañas,
los botones secundarios de toda la app. Va como en la segunda prueba de la app
(`.btn-liso`, https://claude.ai/artifact/MEN8VhUv43HM2sE9pH6kmF): rectos,
blancos con filete y planos; el relieve queda para el principal.

**Qué cambió:** lo que ve quien usa la app. La lógica es la misma.

- **Todos los botones son rectos**, con el radio del principal (10 px). El
  secundario de al lado del principal tenía 6 px y se veía de otra familia.
- **El verde y el rojo** («Confirmar», «Compartir», los botones rojos de los
  avisos de confirmación) **pierden el resplandor de color**: era una sombra
  difusa más.
- **Los secundarios que eran píldoras grises** pasan a botón blanco recto con
  filete y letra en tinta: «Chat» y «Más» de las comandas del Panel, «Chatear»
  y «Comparar» de Mis turnos, «Evento» del Panel, «Ver CV» y «Descargar» de la
  ficha de quien trabaja, «Usar mi ubicación actual».
- **También rectos:** la salida secundaria de las páginas de aviso (404 y
  turno no disponible), «Cómo llegar» del detalle del turno y «Cancelar» del
  recorte de fotos.
- **Los «Volver» y «Dejar para después» de la bienvenida** pasan de `ink/50`
  y `ink/35` (3,5 y 2,3 de contraste sobre el lienzo claro, calculados) a
  `ink-soft` (7,3 medido; 9,0 de noche).

Contraste de los secundarios, medido renderizado (`e2e/botones-relieve.spec.ts`
lo exige ≥ 4,5 en claro y de noche): letra en tinta sobre la tarjeta, 18,9 en
claro y 15,2 de noche; adentro de la comanda el papel va forzado a claro, 18,9.

Técnico: `components/ui/Button.tsx` (radio `--radius-relieve` en todas las
variantes; `secondary` y `danger` sin `--shadow-success`/`--shadow-danger`) y
la constante `BOTON_LISO`, para lo que no puede ser un `Button` (un `Link`, un
`<a>`), exportada en `components/ui`. Se tocaron `ShiftActions.tsx`,
`LocationPicker.tsx`, `PaginaAviso.tsx`, `ShiftDetail.tsx`,
`ImageCropModal.tsx`, `app/my-shifts`, `app/shifts`, `app/workers/[id]` y
`app/bienvenida`. Spec nuevo: `e2e/botones-relieve.spec.ts`.

**Por qué así:**

- **Planos y no con un relieve más chico:** el ADR-0027 pide un objeto con
  relieve por pantalla. Un secundario con relieve competía con el principal.
- **Una constante y no una clase de CSS:** `BOTON_LISO` son clases de
  Tailwind, así el `hover:` y los `disabled:` siguen funcionando (una clase
  sin capa en `globals.css` les ganaría).
- **Fuera de este cambio:** los botones redondos de sólo ícono (volver, cerrar,
  guardar), los chips de filtro y de oficio (no son botones de acción), el
  menú del admin y la encuesta para locales, que es una pantalla propia.

**Queda abierto:** los pasos tachados a mano, los colores de los sellos y el
detalle del turno (ítem 0 de `STATUS.md`).
