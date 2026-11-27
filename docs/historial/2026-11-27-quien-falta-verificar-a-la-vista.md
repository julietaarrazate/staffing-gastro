# El comercio ve de entrada a quién todavía no puede elegir (#759)

**Antes:** con la verificación de identidad obligatoria prendida (#755), el
comercio tocaba «Elegir» sobre alguien sin verificar y recién ahí el servidor
le decía que no se podía.

**Después:** la lista de postulantes y la de recomendados traen
`falta_verificar` (regla prendida y persona sin identidad verificada). En
Candidatos, esa persona dice «Todavía no verificó su identidad» y no ofrece
«Elegir»: ni en la fila, ni en la tarjeta destacada, ni en la ficha de al
lado de la compu. Con la regla apagada el campo es siempre `false` y la
pantalla queda como estaba. El rechazo del servidor (409) sigue igual: es la
regla; esto es sólo el aviso.

Además (pedido de la revisión independiente): quien todavía no se puede
elegir va después de quienes sí, en postulantes y en recomendados (el orden
entre pares no cambia; quienes ya tuvieron el turno y lo dejaron siguen al
final), así la tarjeta grande es siempre alguien elegible. Si nadie de la
pestaña verificó, la pantalla lo dice arriba (`nadie-verificado`). Con el
turno ya asignado o cerrado el aviso no aparece: ahí no se promete nada.

**No se hizo:** avisarle a la persona «un comercio quiso elegirte, verificá
tu identidad». Necesita su propia acción y un tope para no repetir el aviso;
queda anotado en el tablero.

**Pruebas:** `backend/tests/test_verificacion_obligatoria.py` (el campo con la
regla prendida, verificada y apagada), `e2e/candidatos-buscar-grupo-g.spec.ts`
(se ve el aviso y no hay botón; la verificada sí lo tiene). Mirado en claro y
oscuro a 390 y a 1280.
