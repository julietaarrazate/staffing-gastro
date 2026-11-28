# El aviso de turno cerca llega a 20, con 5 lugares para gente nueva (#PENDIENTE)

**Antes:** el aviso de un turno publicado le llegaba a los 10 mejor
rankeados cerca (más los favoritos del comercio), y a 20 en la escalada de
los 8 minutos. Quien recién entraba, sin historial, podía quedar siempre
debajo del tope: sin aviso no hacía su primer turno, y sin primer turno no
subía en el orden.

**Después (decisión de Julieta, 2026-11-28):** la primera tanda avisa a 20 y
la escalada a 40. Una cuarta parte del cupo (5 y 10) se reserva para gente
nueva (sin turnos hechos en Oído) con la identidad verificada, la más cercana
primero. Si no hay tanta gente nueva, esos lugares vuelven a los que siguen en
el ranking. Los favoritos del comercio siguen entrando aparte del tope.

**Cómo:** `shift/domain/cupo_de_avisos.py` (`repartir_cupo`, puro) y
`ShiftService._rank_nearby`, que consulta las identidades verificadas sólo
cuando el tope corta a alguien.

**Para revisar con volumen:** si una persona empieza a recibir más de cinco o
seis avisos por día, bajar el tope (el aviso tiene que seguir siendo señal).

**Pruebas:** `backend/tests/test_cupo_de_avisos.py`.
