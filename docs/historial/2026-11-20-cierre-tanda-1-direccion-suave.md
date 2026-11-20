# Cierre de la primera tanda en paralelo de la dirección suave (#PR)

**Pedido:** Julieta, 2026-11-20: hacer las pantallas que faltan en tandas en
paralelo, y «mergeá los 3» cuando vio las capturas.

**Qué cambió:** entraron Mis turnos (#703), Chats (#701) y Buscar de quien
trabaja (#702), cada una hecha en su sesión y mergeadas en orden desde una
sola. Este PR deja al día lo compartido que ninguna de las tres tocó:

- `docs/STATUS.md`: el párrafo de la etapa 4 dice qué entró y qué tanda está
  en curso (Panel del comercio, Perfil y Mapa).
- `frontend/app/globals.css`: se borran las reglas `.comanda-oportunidad`,
  sin uso desde que Buscar dejó la comanda (#702).
- `docs/design-system/direccion-relieve.md` y
  `docs/reference/MAPA_DEL_CODIGO.md`: las filas que nombraban a
  `OportunidadComanda` y a `ShiftCard` como la tarjeta del trabajador.

**Por qué así:** el tablero de un renglón por pantalla (#700) anduvo: los
tres PRs no chocaron en los docs. Chocaron Chats y Mis turnos en
`globals.css`, porque las dos agregaron sus reglas al final del archivo; se
resolvió dejando los dos bloques. Para la segunda tanda cada sesión tiene
indicado un lugar distinto del archivo. El orden de merge fue el de quién ya
traía el `main` del momento (entró el #684 en el medio): primero Mis turnos,
sin otra corrida; a Chats y a Buscar se les trajo `main` y se esperó su CI.

**Queda abierto:** la segunda tanda (Panel, Perfil, Mapa); `ReviewBox`, que
deja un segundo ámbar en Mis turnos al calificar (va con el Panel); y lo que
cada pantalla dejó afuera por ser función nueva, listado en su historial.
