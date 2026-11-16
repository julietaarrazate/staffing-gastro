# El pago con coma ya no se multiplica por 100 (#PR)

**Pedido:** grave de la prueba en la app del 2026-11-14 (tablero, «Hallazgos
nuevos»). En publicar turno y en el evento, escribir «15000,50» dejaba el
campo en «1500050» y el turno salía con $1.500.050, sin aviso. Julieta
decidió el diseño: monto en pesos enteros, campo de texto con teclado
numérico, el punto es separador de miles y la coma decimal (redondeando al
peso), y al salir del campo se ve formateado («15.001»).

**Qué cambió:** el pago del asistente de publicar (`/shifts/new`, paso
«¿Cuánto pagás?») y el «Pago c/u» de cada puesto del evento
(`/shifts/new-event`) usan un campo nuevo del Design System,
`frontend/components/ui/PesosInput.tsx`. Mientras se escribe se ve lo
tecleado; al salir, «15.001». Las reglas están en `frontend/lib/pesos.ts`:

- `leerPesos`: «15000,50» → 15001; «15.000» → 15000; «$ 15.000» → 15000.
  Un punto que no separa un grupo de tres cifras («15.00», «1.5»,
  «15000.5») o varias comas no se adivinan: el campo queda en rojo
  (`aria-invalid`) y el formulario no deja seguir.
- `formatearPesos`: «15001» → «15.001».
- `pesosDesdeApi`: lo que llega de la API, de la IA o de un borrador
  guardado («15000.00», con punto decimal) se pasa a pesos enteros antes de
  entrar al formulario (duplicar turno, «Describí el turno», borrador
  recuperado, borrador de evento del asistente).

El estado de los dos formularios guarda siempre el monto canónico (sólo
dígitos), así que el backend recibe un entero y todos los `Number(payAmount)`
de las pantallas siguen valiendo. Los placeholders pasan a «48.000» y
«15.000». En `eslint.config.mjs`, `label-has-associated-control` reconoce
`PesosInput` como control (el `<label>` del evento lo envuelve).

**Por qué así:** con `type="number"` el navegador decide qué hace con la
coma y no avisa; con texto, la lectura es nuestra y está probada. Ante un
punto ambiguo se frena en vez de adivinar, porque adivinar fue el error.
Con `inputMode="numeric"` el iPhone muestra sólo cifras: ahí la coma no se
puede escribir, y está bien porque el monto es entero.

**Pruebas:** `lib/pesos.test.ts` (30 casos), e2e nuevo en
`employer-wizard.spec.ts` (coma, punto ambiguo, resumen y cuerpo del POST
con `"15001"`) y en `evento-con-zona.spec.ts` (el pago del puesto llega como
`"15001"`); los specs que buscaban el placeholder «48000» se actualizaron.

**Queda abierto:** verlo en un celular real con teclado en castellano (el
e2e corre en Chromium de escritorio). El backend sigue aceptando decimales en
`pay_amount`; no se tocó.
