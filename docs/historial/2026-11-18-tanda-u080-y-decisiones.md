# Tanda del 2026-11-18 (segunda parte): U080 y las decisiones 21, 22 y 24

**Pedido:** Julieta, en una sesión nueva: dos arreglos chicos (la baja del
dispositivo al cerrar sesión y el panel sin mapa), U080, y las decisiones 21,
22 y 24 del tablero, un PR por ítem, con revisión independiente y prueba en
la app; cortar después del punto 5 si la sesión se alargaba.

**Qué entró:** #640 (panel del comercio: «va en camino» también sin mapa),
#646 (baja del dispositivo), #647 (U080, turno reofrecido), #649 (decisión
22), #651 (decisión 24) y el PR de la decisión 21. Cada uno tiene su entrada
en este historial.

**Decisiones de Julieta en la sesión:** el mínimo para reofrecer pasa de 1 a
2 horas, y sale de la oferta con menos de 2 horas (decisión 19 actualizada;
en el código, más 15 minutos a la vista); la puntualidad de quien toma un
turno reofrecido no se mueve; el barrido de dispositivos se mergea entero
(borra registros de producción); marcar pagado después del cierre automático
sigue contando como tardío, y los avisos lo dicen antes.

**Lo que dejó la tanda:** la revisión independiente o la suite completa
encontraron algo en todos los ítems (un turno común que cambiaba de reglas
si la persona confirmaba tarde, el borde de las 2 horas, avisos urgentes por
un turno oculto, la ficha del admin que no mostraba el turno empezado). El
cupo de uso se cortó tres veces; las recetas quedaron en
`docs/reference/SESION_CLOUD.md` §5 y §8.

**Queda abierto:** la pasada por clase de error con los tests de contrato
(punto 6) y P1 a P5 (punto 7), en una sesión nueva. Bordes que decide
Julieta, anotados en el tablero: los dos de la decisión 22 (la marca toma el
estado de la cuenta al vencer; el cierre directo con poco horario no la
lleva).
