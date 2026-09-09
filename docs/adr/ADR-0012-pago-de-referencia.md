# ADR-0012 — Pago de referencia: un cálculo, dos caras

**Estado:** aceptado · **Fecha:** 2026-09-09

## Contexto

El rediseño del mapa (#319) dejó el marcador de turno con tres estados
implementados —reposo, urgente, activo— y un cuarto declarado pero vacío:
**"match"**, la oportunidad especialmente compatible. El comentario de
`ShiftMarker.tsx` lo dice sin vueltas: *"necesita un score de compatibilidad
que hoy el turno no trae del backend"*. Este ADR decide qué significa ese
estado, porque la respuesta obvia es incorrecta de una forma que no se nota.

**Por qué NO se reusa el motor de matching existente.** Ya hay un scoring real
(`matching/domain/scoring.py`) con pesos que suman 1.0: distancia 0.30,
reputación 0.25, experiencia 0.15, puntualidad 0.15, desempeño 0.15. Pero ese
score responde *"¿qué tan bueno es este trabajador para este turno?"* — es la
pregunta del comercio. Cuatro de sus cinco factores (el **70%** del peso) son
atributos del trabajador: su reputación, su experiencia, su puntualidad y su
desempeño **no cambian entre un turno y otro**. Si se usara para decidir qué
pin se ilumina en el mapa de un trabajador, lo único que variaría entre los
pines sería la distancia (0.30) — el resto es un offset constante. El estado
"match" sería, literalmente, *el turno más cercano con disfraz de
compatibilidad*, y dos trabajadores de perfiles opuestos verían el mismo orden
de pines. Una señal que parece informativa y no lo es es peor que ninguna:
entrena a la gente a ignorarla.

**Por qué tampoco alcanza el skill.** La spec de la tarjeta
(`MAPS_REDESIGN.md` §5) sugiere "compatibilidad (si el skill matchea el
perfil)". Pero el feed ya filtra por los rubros que el trabajador eligió
(decisión del 2026-07-30: antes le llegaban ofertas de cualquier rubro). En
`/map` casi todo lo visible ya matchea su perfil, así que el skill como señal
aporta casi cero información.

**Qué sí varía por turno y decide.** El pago. Es lo primero que mira un
trabajador —por eso el rediseño del pin puso el monto adentro del marcador— y
es lo único que cambia de verdad entre las opciones que tiene enfrente.

## Decisión

Se introduce el **pago de referencia**: la mediana del pago **por hora** de los
turnos publicados recientemente para el mismo puesto en la misma ciudad. Un
solo cálculo, expuesto a las dos partes:

- **Al trabajador** (`/map`, `/feed`): el turno se compara contra la referencia
  y se marca si paga **por encima de lo típico**. Ése es el estado "match".
- **Al comercio** (al publicar y en su panel): la misma comparación al revés —
  *"tu turno paga por debajo de lo típico para mozo en Palermo"*. Hoy el
  comercio no tiene forma de saber por qué su turno no se llena, y la causa
  más común es el precio. Es la mitad que convierte esto de una decoración
  para el trabajador en una herramienta para los dos.

### Cinco reglas del cálculo, y por qué

1. **Por hora, no por turno.** `pay_amount` es del turno completo y los turnos
   duran distinto: comparar el pago de uno de 4 horas contra uno de 8 no
   compara nada. Se normaliza con `start_at`/`end_at`. Sin esta regla la
   feature es ruido con apariencia de dato.
2. **Mediana, no promedio.** Con muestras chicas —y en una beta cerrada todas
   lo son— un solo turno de evento con pago alto corre el promedio y deja a
   todos los demás "por debajo de lo típico". La mediana no se mueve por un
   outlier.
3. **Muestra mínima, o no se muestra nada.** Con menos de `MIN_SAMPLE_SIZE`
   turnos no hay referencia: el backend devuelve `null` y la UI no dibuja
   nada. No se inventa un número ni se rellena con un default — mismo criterio
   que el resto del producto (sin datos simulados). Es la regla que hace que
   esto sea honesto durante la beta, cuando el dato escasea.
4. **Ventana temporal.** Sólo turnos de los últimos `BENCHMARK_WINDOW_DAYS`.
   En Argentina un pago de referencia de hace seis meses no está viejo: está
   mal. Un benchmark desactualizado le diría al comercio que paga bien cuando
   ya no, que es peor que no decirle nada.
5. **Banda, no ratio crudo.** Se expone `por_encima` / `tipico` / `por_debajo`
   con un margen alrededor de la mediana, más el valor de referencia. Un turno
   que paga 2% más que la mediana no es una oportunidad, es la mediana con
   ruido; sin la banda, la mitad de los turnos saldría "por encima" por
   redondeo.

### Qué queda afuera de esta versión, con motivo

La **fiabilidad del comercio** (`on_time_payment_rate`, `late_cancellations`)
era la otra mitad natural: al trabajador le importa tanto cuánto le pagan como
si le van a pagar. Queda afuera por la misma razón que se descartó el motor de
matching: `payments_recorded` arranca en 0 y en la beta casi ningún comercio
tiene historial de pagos todavía, así que hoy la señal sería **constante para
todos** — exactamente el defecto que este ADR evita. Entra cuando haya
historial real, sin cambiar la forma de la respuesta (la banda de pago ya es
un campo aparte).

## Consecuencias

- El trabajador ve, de un vistazo en el mapa, cuál de los turnos cerca suyo
  paga por encima de lo normal para su puesto. Es la decisión que estaba
  tomando a mano comparando montos de turnos de duración distinta.
- El comercio recibe la causa más probable de que su turno no se llene, en el
  momento en que todavía puede corregirla (al publicar), no después.
- El cálculo es **derivado**: no agrega tablas ni columnas nuevas, sale de los
  turnos que ya existen. No hay migración.
- **Caveat conocido:** mientras queden en la base los turnos de las cuentas
  demo sembradas antes de apagar `SEED_DEMO_DATA`, sus pagos entran en la
  referencia. La purga de esas cuentas ya está pendiente por otro motivo
  (`docs/reference/DEPLOY.md`, runbook "apagar el modo demo"); hasta que se
  haga, la referencia de un puesto con pocos turnos reales puede estar
  inclinada por datos de demostración.
- Los valores (`MIN_SAMPLE_SIZE`, `BENCHMARK_WINDOW_DAYS`, el ancho de la
  banda) son **semillas conservadoras y ajustables**, no constantes sagradas —
  mismo criterio que los pesos del matching y que las suscripciones Fase 1. Se
  revisan cuando haya volumen real.
