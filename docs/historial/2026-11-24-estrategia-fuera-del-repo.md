# La estrategia sale del repositorio público

**Pedido:** Julieta, 2026-11-24: el repositorio es público; lo de estrategia
tiene que quedar privado.

**Qué cambió:** `docs/planning/PROPUESTA_HORARIOS_EQUIPO.md` pasó a la pestaña
«Horarios del equipo» del documento privado de crecimiento y se borró del
repositorio. `STATUS.md`, el tablero y el historial del 2026-11-22 apuntan al
documento. `CLAUDE.md` («No hacer») suma la regla: planes de negocio,
competencia, propuestas sin decidir y números van al documento privado; en el
repositorio queda sólo un puntero.

**Por qué así:** el documento de crecimiento y la maqueta ya eran privados
(sólo los abre Julieta). Hacer privado el repositorio se descartó por ahora: en
GitHub los repositorios privados tienen minutos de CI limitados, y con el
límite de gasto en USD 0 (ADR-0030) la CI se frenaría a mitad de mes.

**Queda abierto:** el archivo borrado sigue en el historial de git (estuvo
público del 22 al 24/11). Borrarlo de ahí exige reescribir la historia de
`main`; no se hizo porque no tenía datos sensibles (ni claves ni números).
