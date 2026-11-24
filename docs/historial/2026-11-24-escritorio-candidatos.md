# Candidatos con la ficha al lado y el detalle del turno en dos columnas, en la compu

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (renglones 2 y 12 de
`docs/planning/ESCRITORIO_PANTALLAS.md`).

**Qué estaba mal a 1440 px:** las dos pantallas eran la columna de celular centrada (~640 px) con la
mitad del ancho vacío. En Candidatos, ver a una persona obligaba a ir a `/workers/[id]` y volver. En el
detalle del turno (`/turno/[id]`), la portada (foto o cielo) ocupaba una franja de 640 px arriba de una
hoja corta.

**Qué cambió (todo desde `lg`, 1024 px; el celular y la tablet no cambian):**

- **Candidatos (comercio):** el marco pasa a `--app-frame` y la hoja a dos columnas. A la izquierda, las
  pestañas y la lista (todos en filas, sin tarjeta destacada: la primera lleva su rótulo «Mejor
  calificación» o «Recomendación de Oído»); a la derecha, la ficha de la persona elegida, fija al
  scrollear. Tocar una fila elige a quién mirar (no navega; con Ctrl o Cmd sigue abriendo el perfil en
  otra pestaña); por defecto, la primera. «Elegir a <nombre>» pasa a la ficha y es el único ámbar. La
  asignación, el orden, los avisos y el «¡Oído!» son los de siempre.
- **La ficha** (`candidate/FichaCandidato`) cuenta lo mismo que `/workers/[id]`: el cuerpo de esa
  pantalla se sacó a `profile/FichaTrabajadorContenido`, que usan las dos (un solo lugar para
  reputación, favorito, bio, puestos, datos, CV, insignias y reseñas). Lleva «Ver ficha completa».
- **Detalle del turno (trabajador, y quien llega por link):** portada a la izquierda (foto del local o
  cielo, a toda la altura) y la hoja a la derecha con el pago, el cuándo, el dónde y «Postularme»; el
  marco pasa de 672 a 1024 px.

**Técnico:** `lib/use-es-compu.ts` (`useEsCompu`, `matchMedia` sin parpadeo de servidor: sólo para
pantallas que cargan del lado del cliente), `app/shifts/[id]/candidates/page.tsx`,
`components/candidate/{CandidatoFila,FichaCandidato}.tsx`, `components/ShiftDetail.tsx`. Pruebas: tres en
`e2e/candidatos-suave.spec.ts`; `e2e/turno-en-compu.spec.ts` (nueva, ver abajo).

**Por qué así:** en la compu la decisión del comercio es comparar personas; sin tarjeta destacada ni
ámbar por fila, el ámbar queda en una sola acción (la de la persona que se está mirando). Se descartó
una segunda página de ficha o un modal: la lista no se pierde y no hay ida y vuelta.

**Prueba del turno:** `/turno/[id]` se arma en el servidor, así que `page.route` no la simula (trampa de
`SESION_CLOUD.md` §4). `e2e/turno-en-compu.spec.ts` levanta su propia API simulada y sólo corre con un
build hecho contra ella (`TURNO_API_PORT`); en CI se saltea. Capturas del antes y el después a 390, 768,
1024 y 1440 px en claro y oscuro: a 390 y 768 son idénticas (sólo difiere la nube que se mueve).

**Queda abierto:** nada de estos dos renglones. Si Julieta prefiere que el turno corra en CI, haría
falta un build de e2e con una API simulada (decisión de infraestructura, no se tocó el pipeline).
