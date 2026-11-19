# Privacidad: el pin desplazado del trabajador ya no se deshace con un punto conocido

**Pedido:** Julieta, pasada por clase de error de la beta (etapa 2, punto 1
del 2026-11-19). Hallazgo PRI-02 de la clase «privacidad entre roles», grave,
verificado por un segundo agente con un test que fallaba.

**Qué cambió:** el mapa del comercio y su búsqueda de trabajadores muestran
el pin en otro lugar que antes (una vez): ahora sale del centro de una celda
de 0,2 km, desplazado con una clave del servidor, redondeado a 4 decimales, y
queda entre 150 y ~640 m del punto real (antes, 150 a 350 m con el mismo
vector siempre). Para quien
usa la app no cambia nada más.

- `backend/app/core/geo.py`: `fuzz_point` usa `_fuzz_cell` (grilla con el
  paso en longitud corregido por la latitud) y `_fuzz_key` (clave derivada de
  `JWT_SECRET_KEY`); la semilla es `perfil:fila:columna` por HMAC-SHA256.
- `docs/adr/ADR-0014-ubicacion-en-tiempo-real.md`: actualización 2026-11-19.
- Tests: `backend/tests/test_geo.py` y
  `backend/tests/test_pin_desplazado_punto_conocido.py`; se ajustó el
  comentario de `test_matching.py::test_top_candidates_score_does_not_leak_the_real_distance`.

**Por qué así:** el vector fijo por trabajador era lo que permitía restar.
Sólo meter la celda en la semilla no alcanzaba: dentro de una misma celda
el vector seguía siendo el mismo y un domicilio a pocas cuadras del local
quedaba expuesto igual; por eso el pin parte del centro de la celda y no del
punto. La primera versión de este arreglo dejaba el pin a veces a 50 m de la
casa (el anillo se medía desde el centro); se corrió media diagonal hacia
afuera para conservar los 150 m mínimos. La revisión independiente encontró
que el pin con todos sus decimales delataba la celda (el desplazamiento sale
de enteros de 32 bits y sólo el centro verdadero los devolvía); por eso se
publica redondeado. Se descartó una variable de entorno
nueva para la clave: derivarla de `JWT_SECRET_KEY` evita un trámite más.

**Queda abierto:** nada de este hallazgo. El resto de la pasada, en
[`planning/BETA_TABLERO.md`](../planning/BETA_TABLERO.md).
