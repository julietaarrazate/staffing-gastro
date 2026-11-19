# Los colores de los sellos (beta, etapa 4)

**Pedido:** Julieta, 2026-11-19: el quinto de los cambios de toda la app de la
dirección «con relieve». La revisión de Mis turnos (2026-11-18) había dejado
anotado que el sello «Confirmado» daba 4,49 sobre el papel de noche (el mínimo
es 4,5), y que lo arreglara el PR de los colores de los sellos, porque lo
comparten el Panel y Mis turnos.

**Qué cambió:** el estado de cada turno como sello de goma, en las comandas del
Panel, de Mis turnos y del Inicio («Urgente»). La lógica es la misma: qué
estado tiene cada turno.

- **Cuatro tintas fijas**, elegidas para el papel de la comanda, que es claro
  en los dos temas (blanco de día, `#eef3f6` de noche):

  | Tinta | Para qué | Papel de día | Papel de noche |
  |---|---|---|---|
  | Verde `#166534` | Lo que salió bien: confirmado, llegó (check-in), finalizado, pagado | 7,1 | 6,4 |
  | Azul hondo `#1c5478` | Lo que está en curso: publicado, asignado, en camino, trabajando | 8,1 | 7,3 |
  | Rojo `#c22f2f` | Cancelado y «Urgente» | 5,6 | 5,0 |
  | Gris `#4b5563` | Lo que no arrancó o no se cubrió: borrador, no cubierto | 7,6 | 6,8 |

  (Calculados con los colores; `e2e/sellos-relieve.spec.ts` mide cada estado
  renderizado sobre su papel y exige 4,5 en claro y de noche.)
- **El verde es un punto más hondo** que el de antes (`#15803d`, que daba
  4,49 sobre el papel de noche).
- **«Llegó» (check-in) pasa a verde**, como en la segunda prueba de la app
  («verde para confirmado y llegó»); antes iba en azul.

Técnico: `.sello-verde`, `.sello-azul`, `.sello-rojo` y `.sello-gris` en
`globals.css`, junto a `.sello-goma`; `SELLO_COLORS` de `ShiftCard.tsx` y el
«Urgente» de `ShiftCard` y `FeedHero` las usan en lugar de `text-success-text`,
`text-danger-text` y `text-primary-text`. Antes tomaban los colores del tema,
y como la comanda fuerza el claro por dentro daban lo mismo de día y de
noche; con tintas fijas queda dicho. `shifts-panel-status.spec.ts` busca las
clases nuevas. Los valores, en `design-system/color-system.md`.

**Por qué así:**

- **Tintas fijas y no del tema:** el sello vive sobre papel, y el papel no
  cambia con el tema.
- **El rojo sigue igual:** da 5,0 sobre el papel de noche.

**Revisión independiente** (la misma que la de los pasos tachados; Panel,
Mis turnos e Inicio, claro y oscuro, 320 a 1280, todos los estados):
aprobada. Midió cada tinta en el navegador sobre los dos papeles (verde 7,1
y 6,4; azul 8,1 y 7,3; gris 7,6 y 6,8; rojo 5,6 y 5,0) y comprobó que los
sellos largos («Buscando personal», «No cubierto») entran a 320 px.

**Queda abierto:** el detalle del turno (ítem 0 de `STATUS.md`).
