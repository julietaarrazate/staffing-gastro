# Beta etapa 3, grupo K: detalles sueltos de pantalla (zoom, Comanda, Mi plan, «Me falta saber»)

## Pedido
Cuatro hallazgos de la auditoría de interfaz: U044, U046, U047, U061.

## Qué cambió
- **U044** `app/layout.tsx`: se sacaron `maximumScale: 1` y `userScalable: false`; se puede hacer zoom con pellizco. Los inputs de `TextField` usan `text-body`; no se tocó el tamaño de ningún input (queda anotado: si algún input crudo de la app está bajo 16 px, iOS puede hacer auto-zoom al enfocarlo; no se relevó uno por uno).
- **U046** `lib/pedido-natural.ts`: «de/a/por/en la mañana» se descarta antes de leer el día (es la hora, no el día siguiente) y un día explícito (viernes) gana sobre «mañana» suelto. Tests nuevos en `pedido-natural.test.ts`.
- **U047** `PlanCard.tsx`: se sacó el anillo ámbar del plan actual; queda un solo indicador, la etiqueta «Tu plan actual» (ahora neutra). El ámbar de la pantalla es el botón «Mejorá tu plan»; el azul, el plan elegido desde la landing. Sin cambios de precios ni textos.
- **U061** `app/shifts/new/page.tsx`: «Me falta saber…» se muestra también en los pasos 1 a 3 (donde cae el asistente al saltar), debajo del título. En el paso 0 sigue en el recuadro de «Describí tu turno». Test E2E nuevo en `shift-ai-parse.spec.ts`.

## Por qué así
Mover el aviso al paso destino es más simple y seguro que impedir el salto, que fue un pedido explícito de Julieta (no frenar en pasos ya resueltos).

## Queda abierto
- Relevar inputs crudos con tamaño de letra menor a 16 px (auto-zoom en iOS).

## Ronda de revisión
- U044: `globals.css` lleva input/select/textarea a 16px bajo 768px (sin tocar alto ni padding); anotado en `typography.md`. Verificado a 390 en claro y oscuro (Datos del comercio, publicar, chat): sin desborde.
- U047: la barra de uso del plan pasa de ámbar a `--focus-ring` (azul hondo / celeste); queda un solo ámbar.
- U061: «Me falta saber…» se apaga al completar a mano el dato del paso.
