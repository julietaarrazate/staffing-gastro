# Cierre de la dirección suave: lo suave es la base de la app (#725)

**Pedido:** Julieta. Ejecutar el punto 6 de [ADR-0028](../adr/ADR-0028-direccion-suave.md):
cuando estén todas las pantallas, las reglas de `.estilo-suave` pasan a ser la
base de la app y se borra lo «con relieve» que ya no usa nadie. Es una
limpieza: no debe cambiar cómo se ve ninguna pantalla, y la landing no se toca.

**Inventario (antes de cambiar nada):**

- `frontend/app/globals.css` tenía 186 selectores bajo `.estilo-suave`
  (unas 150 reglas, en bloques al final de varios autores, de la línea 3312 a
  la 5626), más 3 reglas de «chrome» que preguntan si la pantalla lleva la
  clase (`main:has(.estilo-suave …)` y el velo de la barra). `.estilo-suave`
  estaba en 32 archivos `.tsx` (pantallas y capas).
- De esas reglas, sólo pisaban a una regla «con relieve» de la base: `.boton`,
  `.boton-relieve` y los tokens `--suave-*`. El resto son clases propias de la
  dirección suave (`.tecla`, `.campo`, `.casilla`, `.burbuja`, `.dia-boton`…)
  que no tenían versión «con relieve» en CSS.
- «Con relieve» que quedaba, y quién lo usaba: `.boton-relieve` (base; lo usa
  el `Button` primario y 9 pantallas, todas ya suaves), `.tarjeta-relieve`,
  `.letra-cartel*`, `.apunte`, `.flechita`, `.sello-*`, `.app-banda`, `.riel`,
  `.comanda*` y `.chip-vidrio.boton-cielo`: **nadie fuera de tests que
  verifican que no estén**. La variante `comanda` de `ShiftCard` no la pasaba
  ninguna pantalla (ni la landing); `ui/Comanda.tsx` sólo lo usaba esa
  variante; `Row`/`RowGroup` de `ProfileParts` no los importaba nadie.
- La landing (`components/landing/`, `app/page.tsx`, `app/historia`) usa sus
  propias clases `.landing-*` y los tokens `--relieve`, `--shadow-relieve*`,
  `--radius-relieve`, `--relieve-btn`; no usa ninguna de las reglas suaves.
  La única excepción: `/historia` muestra réplicas de la app de antes
  (`CandidateCard`, `OpportunityCard`) con el `Button` compartido
  (`.boton`, `.boton-relieve`).

**Qué cambió:**

- `globals.css`: en cada regla bajo `.estilo-suave`, `.estilo-suave` pasó a
  `:root` (pesa lo mismo que una clase, así que la cascada contra las demás
  reglas queda igual; las de noche, `:root[data-theme="dark"] .estilo-suave X`,
  pasaron a `:root:root[data-theme="dark"] X`, también con la misma
  especificidad). Los tokens `--suave-*` y `--radio-suave` están en `:root`.
  Las reglas siguen en su lugar, sin reordenar. `.boton-relieve` quedó
  fusionado en una sola regla suave (el ámbar en degradé conserva el
  desplazamiento de 3 px al apretarlo, el anillo de foco separado y el
  desactivado de antes).
- **`.estilo-suave` se deja en las raíces** (es inofensivo) y ya no estiliza
  nada: es la marca de las 3 reglas de chrome de arriba. Una pantalla nueva no
  la necesita salvo que termine en una hoja.
- **La landing, protegida:** `.estilo-relieve` en la raíz de `LandingStory`
  (`/historia`) y de `LandingCorta` (`/`). Las reglas suaves de `.boton` y
  `.boton-relieve` llevan `:not(:where(.estilo-relieve *))` (especificidad
  cero, no cambia el peso de nada) y bajo `:where(.estilo-relieve)` quedó el
  botón con relieve de antes (el bloque borrado de la base, con el mismo
  peso). Se borra cuando se decida la landing.
- Se borró (`frontend/app/globals.css`, 5.628 → 5.422 líneas): `.letra-cartel`,
  `-pantalla`, `-puesto`, `-sobre-banda` y `.letra-cartel .barra`; `.apunte`,
  `.flechita`; `.tarjeta-relieve`; `.sello-goma/-verde/-azul/-rojo/-gris`;
  `.app-banda`, `.riel`; `.comanda`, `-papel`, `-apagada`, `-fila`;
  `.chip-vidrio.boton-cielo`; los tokens `--comanda-papel`, `--color-cartel`,
  `--app-banda*` y el bloque de `.boton-relieve` de la base.
- Se borró `frontend/components/ui/Comanda.tsx` (81 líneas: `Comanda`,
  `ComandaFila`, `Apunte`, `Flechita`, `textoCartel`) y su export en
  `components/ui/index.ts`; la variante `comanda` de
  `frontend/components/ShiftCard.tsx` (el prop, `SELLO_COLORS` y las ramas);
  `Row`, `RowGroup` y `ROW_CLASS` de `components/profile/ProfileParts.tsx`.
- Docs: nota de cierre en ADR-0028; `marca-hoy.md` ya no dice que el relieve
  rija en la app; renglón «Cierre» de `DIRECCION_SUAVE_PANTALLAS.md`.

**Por qué así:** `:root` en lugar de borrar el prefijo, para no cambiar la
especificidad (las reglas suaves le ganaban a las utilidades y a la base por
pesar `(0,2,0)`; sin prefijo habrían perdido). El `:not(:where())` y no
reescribir las reglas para la landing, porque deja la landing exactamente como
estaba sin duplicar lo suave. Se descartó borrar `.estilo-suave` de las 32
raíces: los tests de pantalla lo usan de localizador y las 3 reglas de chrome
lo necesitan.

**Verificación:** capturas antes/después del mismo worktree (build de
`5219dd8`, y el de este cambio), 40 pantallas × claro/oscuro × 390/1280 (182
imágenes), con la API simulada por los contratos de `e2e/contrato`, el reloj
fijo y las animaciones apagadas. El ruido (antes contra antes) es de cero
píxeles salvo la landing (animada) y un parpadeo de unos 30 píxeles aislado.
Resultado: diferencia **cero** en Inicio, Buscar, Mapa, Mis turnos, Chats,
Perfil (trabajador, comercio y admin), Panel, Publicar turno y evento,
Candidatos, Buscar del comercio, Mi plan, Ajustes, Editar perfil, fichas,
ingreso, crear cuenta, recuperar, bienvenida, Soporte, Favoritos, términos,
privacidad y las pantallas de admin. Con diferencia, las dos que seguían «con
relieve» por error: `/assistant` (el campo y el botón «Completar», unos 4.200
píxeles de 330.000) y `/encuesta` (el botón «Siguiente» pasa del relieve
duro al ámbar suave y las opciones al estilo de tecla, unos 32.000 píxeles).
**Landing:** `/` (con «reducir movimiento»: cero píxeles; animada: los cuadros
de la segunda pantalla en adelante, idénticos) y `/historia`: los estilos
calculados de las 846 y 863 piezas coinciden en las 8 combinaciones, sólo
cambia el nombre de la clase de la raíz; en `/historia` queda además el
parpadeo de los puntitos de «escribiendo…».

**Queda abierto:** decidir la landing (ADR-0028, «lo que quede mejor con la
app»); cuando se decida, se borran `.estilo-relieve`, el bloque de
`.boton-relieve` bajo ese ámbito y los tokens `--relieve*` / `--shadow-relieve*`
que sólo usa `.landing-*`. `.rubro-tile` y `.landing-mano` no las usa nadie,
pero no son de esta dirección y no se tocaron.
