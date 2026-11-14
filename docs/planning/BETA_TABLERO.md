# Salida a beta — tablero

> **Para qué sirve:** que cualquier sesión (o persona) sepa qué está hecho, qué
> está en curso y qué falta, sin releer conversaciones ni volver sobre lo
> hecho. **Se edita en el lugar, en el mismo PR que cambia el estado de una
> fila.** El detalle de cada hallazgo (pasos para reproducirlo, capturas,
> archivo y línea) no vive en este repo, que es público: está en el tablero
> privado de la etapa 1, https://claude.ai/artifact/Fg8FYTDexBaVDi49rCZ1Rh.

**Meta:** que un comercio real publique un turno y un trabajador real lo cubra
en menos de 10 minutos, sin trabarse ni confundirse y sin que nada se vea
descuidado.

**Estados:** ✅ en `main` · 🔵 PR abierto · 🟡 diseñado, sin empezar ·
⏸️ espera una decisión de Julieta · ⚪ sin empezar.

## Etapas

| # | Etapa | Estado |
|---|---|---|
| 1 | Probar de punta a punta, sin arreglar | ✅ cerrada: 142 hallazgos (3 bloqueantes, 79 graves, 60 menores). Entorno de prueba (`tools/e2e-local/`) y estado escrito en #527 |
| 2 | Arreglar: bloqueantes, después graves | en curso (ver abajo) |
| 3 | Que nada se vea descuidado (los 60 menores y lo que salió de las revisiones) | ⚪ |
| 4 | Identidad, marca e isotipo | ⚪ (la landing «con convicción» ya está en producción, #543) |
| 5 | Lista de salida a beta | ⚪ |
| 6 | SEO y GEO | ⚪ |

## Etapa 2

### Bloqueantes (3 de 3 en `main`)

| Qué | Estado |
|---|---|
| Pago con confirmación | ✅ #531 |
| El chat es del comercio con la persona asignada | ✅ #532 |
| Volver a postularse | ✅ #533 |

### Reporte externo de pruebas (8 de 9 en `main`)

| Reporte | Qué | Estado |
|---|---|---|
| BK-8D3E8C5C491E | Reintentar «Publicar» no crea otro turno (cubre U010 y U011) | ✅ #534 |
| BK-ACA2748DAFE3 | Ganancias sin tope de 500 turnos | ✅ #535 |
| BK-670B15B8C122 | Verificación enviada dos veces | ✅ #536 |
| BK-676ABE51EF2C | Guardar una parte del perfil no pisa el resto (cubre U053) | ✅ #540 |
| BK-0C3A2D8D7EE2 | Escape cierra una sola ventana | ✅ #541 |
| BK-8E9CFE08111D | Candidatos: error de carga no es «nadie se postuló» | ✅ #542 |
| BK-9FB6E2BC2226 | Avisos al celular: son de la cuenta con la sesión abierta | ✅ #545 |
| BK-7DCC7E4AB945 | Las claves para no repetir un pedido se pierden al recargar | ⚪ |
| BK-898A15047291 | «Pagado hasta» queda viejo con la pestaña abierta | ✅ #570 |

### Graves, agrupados por causa (un grupo, un PR)

De 79 graves: 48 ya están en `main` (los marcados ✅ abajo, más U010, U011 y
U053, que entraron con el reporte externo); U094 y U137 quedan diferidos
(dependen del tope del plan, que está apagado en la beta).

Los grupos 🟡 tienen su diseño (qué se cambia, dónde, qué se prueba, en qué
orden y quién) en [`BETA_DISENO_GRAVES.md`](./BETA_DISENO_GRAVES.md), con el
mismo número de grupo (G1 a G27) que la columna «Dónde / nota».

**Tanda 1**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U032, U033 | Un turno reabierto (por rechazo, baja o ausencia) aparece en el Inicio, pero al abrirlo o compartirlo dice… (y 1 más de la misma causa) | ✅ en `main` | #537 |
| U015 | El aviso «Turno cerca tuyo» no lleva al turno: con Inicio abierto, tocarlo no hace nada | ✅ en `main` | #538 |
| U070 | Los avisos al celular salen sin margen de espera: si el celular no tiene señal en ese instante, el aviso pu… | ✅ en `main` | #539 |
| U009 | El aviso «Completamos todo…» tapa el botón «Publicar turno» unos 3 segundos | ✅ en `main` | #544 |
| U063, U085 | Inicio, Buscar y Mapa traen los 50 turnos más recientes de todo el país, sin filtrar por distancia: con más… (y 1 más de la misma causa) | ✅ en `main` | #547 |
| U058 | Evento: se publican turnos sin zona («Ubicación a confirmar») y los trabajadores cercanos no reciben aviso | ✅ en `main` | #546 (prueba en la app hecha el 2026-11-13) |
| U013, U014, U016 | El panel del comercio y la lista de candidatos no se actualizan solos (postulante nuevo, confirmación, rech… (y 2 más de la misma causa) | ✅ en `main` | #560 (prueba en la app hecha el 2026-11-14) |
| U080 | Al reabrirse un turno por ausencia nadie recibe un aviso nuevo y, si ya empezó, tampoco vuelve al feed | ⚪ decidido (4), sin empezar | se reofrece como urgente hasta que termine su horario; lleva ADR. Falta saber si se paga el turno entero o lo que resta |

**Tanda 2**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U004, U005 | Dos toques en «Llegué» marcan también «Me fui»: el turno queda terminado al llegar (y 1 más de la misma causa) | ✅ en `main` | #552 |
| U006, U007, U008 | En celular, dos toques en «Continuar» del paso de pago publican el turno sin mostrar el último paso (y 2 más de la misma causa) | ✅ en `main` | #567 (prueba en la app hecha el 2026-11-14) |

**Tanda 3**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U019 | Marcar la llegada más de 15 min antes cuenta como impuntual: «Puntualidad 0 %» | ✅ en `main` | #549 |
| U020 | Quien todavía no tiene reseñas ni pagos aparece con «★ 0,0», «Puntualidad 0 %» o «Pago a tiempo 0 %» en rojo | ✅ en `main` | #551 |
| U079 | «No se presentó» se ofrece y se aplica sobre un turno que todavía no empezó, y penaliza al trabajador | ✅ en `main` | #550 |
| U081 | Se puede cancelar un turno cuyo trabajador ya terminó de trabajar (check-out hecho) | ⚪ decidido (2), sin empezar | no se permite: con la salida marcada, el comercio finaliza y paga; lleva ADR (cambia el ADR-0007) |
| U082, U089 | Ausencia automática: al trabajador le dice «El comercio marcó que no te presentaste» y al comercio «sin que… (y 1 más de la misma causa) | ✅ en `main` | #562 |
| U076, U077, U078 | Cancelar un turno con postulantes no le avisa a nadie (y 2 más de la misma causa) | ✅ en `main` | #553 |
| U021, U123 | Quien retiró, rechazó, canceló o faltó sigue en la lista de postulantes con «Asignar», sin ninguna marca (y 1 más de la misma causa) | 🟡 diseñado | [diseño](./BETA_DISENO_GRAVES.md), G4 |

**Tanda 4**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U038 | El perfil del comercio muestra «Identidad verificada» con sólo confirmar el mail (incluso con la constancia… | ✅ en `main` | #561 |
| U090, U108 | El sello «Comercio verificado» no aparece en el feed ni en Buscar; sólo en el detalle del turno (y 1 más de la misma causa) | ✅ en `main` | #561 |
| U072 | El trabajador apaga «va en camino» y el comercio lo sigue viendo «en camino» hasta que marca la llegada | ⚪ decidido (3), sin empezar | se apaga al instante también para el comercio; lleva ADR y, con él, el texto de `/privacidad` (decisión 1) |
| U023, U097, U095 | Se puede asignar a un trabajador suspendido: el turno queda «Esperando que confirme» para siempre (y 2 más de la misma causa) | ✅ en `main` | #572 (ADR-0024; revisión independiente y prueba en la app hechas el 2026-11-14) |
| U112, U096 | Con la sesión vencida a mitad de publicar sólo sale «No autorizado» y la app no lleva a ingresar (y 1 más de la misma causa) | ✅ en `main` | #559 (prueba en la app hecha el 2026-11-14) |
| U114, U115 | Si el servidor tarda en despertar al abrir la app, la persona con sesión ve la cabecera de visitante («Ingr… (y 1 más de la misma causa) | ✅ en `main` | #559 (prueba en la app hecha el 2026-11-14) |

**Tanda 5**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U030, U031 | Los errores de validación salen como «Error inesperado» (mail sin dominio, texto corto, cantidad 51, mensaj… (y 1 más de la misma causa) | ✅ en `main` | #571 (prueba en la app hecha el 2026-11-14) |
| U028, U029 | Mensajes de error con la fecha en formato técnico y tres horas corrida («el turno empieza el 2026-11-13T16:… (y 1 más de la misma causa) | ✅ en `main` | #569 (prueba en la app hecha el 2026-11-14) |
| U138, U139 | Registrarse cuando la conexión ya llegó al límite de ingresos: la cuenta se crea, la pantalla dice «Demasia… (y 1 más de la misma causa) | ✅ en `main` | #574 (revisión independiente y prueba en la app hechas el 2026-11-14) |
| U093 | «Mi plan» con el cobro apagado: «9 de 5 turnos usados», «Alcanzaste el límite», «cambiá por $20.000/mes», a… | ✅ en `main` | #570 (prueba en la app hecha el 2026-11-14) |

**Tanda 6**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U034, U035 | Si se corta la bienvenida (recarga, atrás, cerrar) la cuenta queda sin perfil y nada guía a completarlo; el… (y 1 más de la misma causa) | ✅ en `main` | #578 (revisión independiente y prueba en la app hechas el 2026-11-14) |
| U036 | Al elegir una dirección del buscador, la lista se vuelve a abrir y tapa el mapa y el pin | ✅ en `main` | #564 |
| U055, U056, U060 | Se puede publicar un turno con fecha pasada (queda «No cubierto» a los segundos), de 5 minutos o de 30 horas (y 2 más de la misma causa) | 🟡 diseñado | [diseño](./BETA_DISENO_GRAVES.md), G14 |
| U057, U135 | «Describí el turno» con la IA lenta pisa lo que la persona ya cargó a mano (y 1 más de la misma causa) | 🟡 diseñado | [diseño](./BETA_DISENO_GRAVES.md), G15 |
| U062 | Quien llega por un link (compartido o interno) y tiene que entrar o registrarse no vuelve a donde iba | ✅ en `main` | #565 (prueba en la app hecha el 2026-11-14) |
| U054 | Con las notificaciones bloqueadas o si fallan, el interruptor de push no hace nada ni explica por qué | ✅ en `main` | #573 (revisión independiente y prueba en la app hechas el 2026-11-14; el permiso concedido no se puede probar sin pantalla) |

**Tanda 7**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U064, U104 | En compu, en Buscar y en el Mapa no se puede abrir el detalle del turno: uno se postula sin ver la descripc… (y 1 más de la misma causa) | 🟡 diseñado | [diseño](./BETA_DISENO_GRAVES.md), G18 |
| U065, U024, U025 | En Matches → Postulaciones las tarjetas no dicen de qué comercio es cada turno (y 2 más de la misma causa) | ✅ en `main` | #568 (prueba en la app hecha el 2026-11-14) |
| U069 | En «Descubrir rápido», deslizar la tarjeta abre el detalle en vez de pasar al siguiente | 🟡 diseñado | [diseño](./BETA_DISENO_GRAVES.md), G20 |
| U105 | Mapa en celular: la hoja de tarjetas tapa los pines; al abrir sólo asoma la punta de un pin | 🟡 diseñado | [diseño](./BETA_DISENO_GRAVES.md), G21 |
| U071 | Mapa «va en camino»: el encuadre no sigue al trabajador y el punto queda cortado; a más de ~3 km no se ve n… | 🟡 diseñado | [diseño](./BETA_DISENO_GRAVES.md), G22 |
| U073 | «Buscar trabajadores cerca» no parte del local: mide desde el Obelisco o desde donde esté el celular | 🟡 diseñado | [diseño](./BETA_DISENO_GRAVES.md), G23 |
| U026, U075, U124 | En celular, con un nombre largo la tarjeta de candidato se sale de la pantalla y «Asignar» queda afuera (y 2 más de la misma causa) | ✅ en `main` | #566 (prueba en la app hecha el 2026-11-14) |
| U083, U086 | El contador del evento «N/M cubiertos» no baja al cancelar y cuenta cancelados y asignados sin confirmar (y 1 más de la misma causa) | 🔵 PR abierto #577 | G25 |

**Tanda 8**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U125, U126, U127 | «Urgentes sin cubrir» en la portada del admin cuenta urgentes de cualquier día, no sólo de hoy (y 2 más de la misma causa) | 🟡 diseñado | [diseño](./BETA_DISENO_GRAVES.md), G26 |
| U128 | Los tickets no se pueden reabrir, y un mensaje del admin en un ticket cerrado le llega a la persona sin que… | ✅ en `main` | #576 (revisión independiente y prueba en la app hechas el 2026-11-14) |

### Lo que salió de las revisiones y no tiene hallazgo propio

- `POST /shifts/events` no tiene clave de idempotencia: un reintento publica
  el evento dos veces (G25, #577).
- En el contador del evento, «no cubierto» sigue sumando al total (G25, #577).
- El mismo patrón «un error de carga se muestra como lista vacía» en Inicio,
  Buscar, Matches, Mapa y la bandeja del admin.
- El alta del comercio: reentrar y «Omitir por ahora» pisa el perfil.
- El asistente cuenta turnos sobre los 200 más nuevos.
- Falta una pantalla de error general de la app (`app/error.tsx`).
- «Compartir» no aparece en un turno reabierto.
- «Ver mis turnos» lleva a «Matches»: nombres distintos en celular y escritorio.
- A 390 px el cartel «Viendo como…» del admin no muestra el nombre.
- Avisos al celular: que el cierre de sesión borre el dispositivo en el
  servidor (cierra la sesión vencida, el token vencido y las dos pestañas).
- Un turno suelto todavía se puede crear sin zona por la API.
- El aviso flotante queda debajo del velo de un diálogo abierto.
- PR viejo #421 (links de turnos reabiertos): quedó pisado por #537; cerrarlo
  o rescatar lo de «Compartir».
- Formulario de evento: después de tocar «Cambiar» no hay forma de volver a
  «mi local» sin recargar (prueba en la app de #546).
- Mapa del trabajador sin permiso de ubicación: mide desde el centro de
  Buenos Aires aunque el perfil sea de otra provincia; y el fondo del mapa
  queda claro en el tema oscuro (prueba en la app de #547).
- Con «Estoy acá» lejos de la zona, el subtítulo del Inicio deja un punto
  colgado.
- El pin de trabajador en el mapa del comercio usa letra blanca fija
  (`WorkerMarker.tsx`), contra la regla de diseño.
- Plurales sin singular: «1 turnos», «1 turnos publicados», «1 eventos».
- Con sesión de trabajador la app pide `/favorites` y con la de comercio
  `/applications/mine`: el servidor responde 403 (no se ve en pantalla).
- Tras abrir un diálogo de confirmación, durante 1 segundo sus botones se ven
  deshabilitados (es la guarda del toque de más, #552 y #567); un toque
  rápido ahí no hace nada.
- Grilla del Inicio a 1280 px: con un comercio de nombre largo, la cabecera
  de la tarjeta («Parrilla y Vermute… Urgente…») se encima (prueba en la app
  de #567).
- Render publica cada commit de `main` sin esperar al CI: un commit con el CI
  en rojo llega igual a producción (pasó el 2026-11-13, con el código bien y
  un test mal; #555).
- Postular y asignar: si falla el guardado del aviso, la acción queda hecha
  pero la respuesta es un error (salió de la revisión de #553).
- La puntualidad ya guardada de quien llegó temprano antes de #549 no se
  recalculó (es un promedio guardado; tocar datos de producción se pregunta).
- Evento: no existe cancelar varios turnos a la vez; quien se postuló a tres
  recibe tres avisos de cancelación.
- El comercio no recibe ningún aviso cuando el trabajador marca la llegada:
  el panel lo muestra recién con la consulta de «va en camino» (cada 30 s;
  23 s en la prueba en la app de #568). Sumar el aviso es decidir quién
  recibe qué.
- «Mis turnos» con el cartel «¡Turno confirmado!» abierto no se actualiza
  hasta cerrarlo (a propósito, para no pisar un diálogo): si el comercio
  cancela justo ahí, debajo queda «Llegué» hasta tocar «Entendido».
- Campanita: si el WebSocket se cae dos veces en menos de 30 segundos, la
  segunda reconexión no vuelve a pedir las pantallas (tope contra el bucle
  de recargas; salió de la revisión de #560).
- Al pasar del registro al ingreso y volver («Ingresá» / «Creá una») se
  pierden el rol y el plan que venían en la dirección (ya pasaba; la vuelta
  `next` sí se conserva desde #565).
- A 320 px (prueba en la app de #566): en candidatos la pestaña activa
  «Recomendados (10)» sobresale ~9 px de su carril, y en «Turnos en vivo» el
  selector corta «Escalad…» (se puede deslizar). La página no se ensancha.
- El comercio no recibe un aviso propio cuando una persona confirmada falta:
  se entera por el panel, o por el aviso de «no cubierto» si no consigue
  reemplazo (salió de #562; sumarlo es decidir quién recibe qué, va con U080).
- Suspender a un trabajador: si al reabrir su turno falla la vuelta a
  pendiente de los demás postulantes, al repetir ese turno ya no entra y
  quedan rechazados (raro; salió de la revisión de #572).
- El detalle de un turno cancelado por la suspensión del comercio dice «El
  comercio canceló este turno.» (el aviso sí es neutro; #572).

### Hallazgos nuevos de la prueba en la app (2026-11-14)

- **Grave: el pago con coma se multiplica por 100.** En publicar (y en el
  evento), escribir «15000,50» deja el campo en «1500050» y el turno se
  publica con $1.500.050, sin aviso: el campo es `type="number"` y el
  navegador descarta la coma. Ya pasaba antes de #571; se vio en su prueba en
  la app. Falta verificarlo en un celular con teclado en castellano y
  decidir el arreglo (campo de texto con formato de pesos, o aceptar la coma
  como decimal).
- **Menor: la distancia de «Llegué» sale en metros crudos** («estás a 274732
  metros»): conviene kilómetros arriba de 1000 m (#569).
- **Menor: en «Editar perfil», «años de experiencia» mayor a 80** frena con el
  aviso nativo del navegador (en inglés en algunos), no con uno propio.

### Para revisar con Fable (anotado el 2026-11-14)

La sesión del 2026-11-14 siguió con Opus 5.5 cuando se acabó el cupo de
Fable. Lo que sigue quedó para hacerlo o revisarlo con Fable, porque cambia
el modelo del dominio, un ADR vigente o un texto legal:

- **G4** (U021, U123): estado nuevo `desasignada` de la postulación, con
  migración. Toca cómo se asigna y se reasigna un turno.
- **U080, U081 y U072** (decisiones 2, 3, 4 y 16): cambian el ADR-0007 y el
  ADR-0008, y U072 cambia el texto de `/privacidad` (sube la versión, junto
  con la decisión 1).
- **P1 a P5**, las mejoras de producto aprobadas.
- **Una segunda mirada a G6** (cuentas suspendidas, ADR-0024), lo más
  delicado de lo que se hizo con Opus. Ya tuvo una revisión independiente
  (con Opus) y su prueba en la app antes del merge (#572).
- **Pasada por clase de error** (propuesta del 2026-11-14): el reporte
  externo de Breken encontró en una lectura del código 9 errores que la prueba
  de punta a punta no vio (claves que se pierden al recargar, datos viejos con
  la pestaña abierta, guardados que pisan otros datos). La etapa 1 recorrió
  la app como una persona, las revisiones miran sólo el diff de cada PR, y los
  e2e simulan la API a mano (en G8 los tests pasaban con un 422 que el
  servidor nunca manda). Propuesta: un agente por clase (concurrencia e
  idempotencia; estado viejo con la pestaña abierta; sesión; escrituras que
  pisan; fechas y zona horaria; privacidad entre roles) sobre las áreas de la
  beta (turno, postulación, sesión, pagos, avisos), cada hallazgo verificado
  antes de entrar acá. Y tests de contrato: los mocks del frontend armados
  con respuestas reales del backend.
- **«Mi plan» con el cobro prendido y el tope apagado** (una configuración
  intermedia que la beta no usa): la tarjeta dice «Durante la beta no hay
  tope» y el subtítulo de los planes habla del cobro (salió de la revisión de
  #570).

### Criterio de Julieta para decidir (2026-11-13)

«Sí a todo lo que sea seguro y mejor para el sistema y su lógica.» Cada
decisión tiene que servir para **cubrir un puesto rápido**, sobre todo en los
turnos urgentes; en los programados con anticipación se puede buscar con más
tiempo el perfil que mejor calza, no sólo el más cercano. El local necesita
estar seguro de que alguien llega en horario.

### Decisiones tomadas el 2026-11-13

Julieta aceptó las recomendaciones de quien coordina. Las que cambian una
regla ya escrita (2, 3, 4 y 10) llevan su ADR antes del código.

- **1.** `/privacidad` suma que el identificador del dispositivo se borra también
   «al cerrar sesión en ese dispositivo». Sube la versión; va junto con el
   texto que salga de la 3, para pedir que se acepte una sola vez.
- **2.** U081: un turno ya trabajado no se cancela. Con la salida marcada, el
   comercio finaliza y paga; un problema va por soporte.
- **3.** U072: «va en camino» se apaga al instante también para el comercio, que
   vuelve a ver «Confirmado».
- **4.** U080: un turno reabierto que ya empezó se reofrece como urgente hasta que
   termine su horario.
- **5.** El ingreso de invitado se apaga en la beta (vaciar `GUEST_ACCESS_PIN` en
   Render: lo hace Julieta o lo pide).
- **6.** #527 se mergea: resolver el conflicto con `main` y marcar el aviso de
   GitGuardian como dato de prueba sin reescribir el historial, después de
   confirmar que el valor no es una clave real.
- **10.** Cuenta suspendida (G6). Comercio: sus turnos abiertos dejan de verse y de
    aceptar postulaciones; los que tienen a alguien asignado o confirmado y
    no empezaron se cancelan con aviso, sin penalidad. Trabajador: sus turnos
    confirmados se reabren y se le avisa al comercio.
- **11.** «Mi plan» mientras no se cobra (G11): el uso sin alarma y «Durante la
    beta no hay tope de turnos»; sin «Alcanzaste el límite» ni la oferta.
- **12.** El trabajador ve en su propio perfil sus cancelaciones y ausencias
    (U089); un mensaje del admin reabre el ticket cerrado (U128); al ingresar
    con la cuenta suspendida se dice a quién escribir, sin el motivo (U095).
- **13.** Quien rechazó, canceló o faltó queda al final de los postulantes, con su
    marca, y se puede volver a asignar; quien retiró su postulación no
    aparece (G4).
- **14.** Avisos: uno al trabajador cuando la app le retira postulaciones por
    confirmar otro turno del mismo horario (U123), y uno solo por evento en
    vez de uno por puesto (U086).
- **15.** Un turno dura entre 1 y 16 horas (G14).
- **7.** Quien marcó la llegada temprano y se tiene que ir antes del inicio puede
   cancelar desde «llegada marcada»; cuenta como cancelación y el turno se
   reofrece.
- **8.** Las cancelaciones tardías de un comercio dejan de viajar a los demás
   usuarios (ninguna pantalla las mostraba). Las sigue viendo el propio
   comercio en su perfil.
- **9.** A los 2 trabajadores de producción sin zona se les avisa con el cartel de
   G12 y un mail.
- **16.** Un turno reofrecido que ya empezó se paga por lo que resta, y el aviso lo
    dice.
- **17.** Puntualidad real (propuesta, §4): puntual es estar a la hora de inicio,
    con 5 minutos de margen sólo para marcar; avisos 10 minutos antes, a la
    hora y a los 5 minutos; si la persona no marcó, el comercio decide («Ya
    llegó», a horario o tarde, o «No llegó»); «No se presentó» desde los 10
    minutos.

Julieta, el mismo día, sobre estas cinco y sobre la propuesta: «Confío en tu
criterio y recomendación con la visión de negocio y producto». Se tomaron las
recomendaciones de quien coordina.

### Decisiones que esperan a Julieta

Ninguna al 2026-11-13. El ingreso de invitado (decisión 5) se apaga al abrir
la beta, en la lista de salida (etapa 5): hasta entonces sirve para mostrar y
probar la app.

### Mejoras de producto aprobadas (2026-11-13)

De [`PROPUESTA_URGENTE_Y_PROGRAMADO.md`](./PROPUESTA_URGENTE_Y_PROGRAMADO.md).
Cada una lleva su ADR antes del código y es un PR aparte de los graves.

| # | Qué | Cuándo | Estado |
|---|---|---|---|
| P1 | Puntualidad real (§4, sin marcar por ubicación). Cambia el ADR-0008 y `REPUTATION.md` | Antes de la beta | ⚪ sin empezar |
| P2 | Orden de los postulantes en turnos programados: local y favoritos, experiencia comprobada, cumplimiento, calificación; la distancia sólo filtra (§3) | Antes de la beta | ⚪ sin empezar |
| P3 | Reconfirmación 24 y 3 horas antes (§3 y §5) | Antes de la beta si entra | ⚪ sin empezar |
| P4 | Tomar el turno urgente con un toque (§2) | Primer cambio después de los graves | ⚪ sin empezar |
| P5 | Agenda del trabajador: días, franjas, barrios y rubros; el comercio filtra por fecha, horario, rubro y zona (§3.1). Pedido expreso de Julieta | Paso A apenas cierren los graves; B y C con la beta andando | ⚪ sin empezar |

Referencias verificadas, «Traé a tu equipo» y los suplentes de eventos
quedan para cuando la beta esté andando.
Antes de P3 y P4 conviene la opinión de la asesoría de Julieta (propuesta,
§7).

### Pedidos de producto de Julieta (2026-11-13), fuera de la etapa 2

No son arreglos: cada uno necesita su propuesta antes de construir nada. La
primera propuesta, con opciones, recomendación y orden, está en
[`PROPUESTA_URGENTE_Y_PROGRAMADO.md`](./PROPUESTA_URGENTE_Y_PROGRAMADO.md)
(aprobada en parte, ver la tabla de arriba; el seguro y el cobro quedan
afuera).

- **Urgente y programado no se buscan igual.** El urgente, por cercanía y
  velocidad; el programado, con tiempo, por el perfil que mejor calza
  (experiencia, reputación), no sólo por distancia. Va con
  [`PROPUESTA_COBERTURA_URGENTE.md`](./PROPUESTA_COBERTURA_URGENTE.md).
- **Base de trabajadores con experiencia y referencias reales** para que la
  beta arranque con calidad: cómo captarlos, cómo se cargan y verifican las
  referencias de comercios, y tener esa base como respaldo.
- **Eventos masivos sin bajas el día del evento:** confirmación la víspera y
  el mismo día, suplentes, y qué pasa con quien se baja a último momento.
- **Seguro:** quién lo tramita y quién asegura a la persona (el comercio, el
  grupo gastronómico, ella misma). Es una consulta legal y laboral: necesita
  a la asesoría de Julieta antes de escribir nada en la app o en los
  términos.
- **Cobro de la suscripción sin comisión o con la más baja:** evaluar un QR
  de cobro propio por comercio o una transferencia con alias contra Mercado
  Pago y otras integraciones (hoy: ADR-0022, Checkout Pro, apagado).

### Pruebas que tiene que hacer una persona

- Que un aviso llegue a un celular real con la pantalla apagada, sin señal o
  en modo avión, y después (#539).
- Instalar la app en un celular y recibir un aviso con la app cerrada.
- Un pago real de punta a punta.
- La ubicación real de un celular en la calle («Disponible ahora», «Va en
  camino», el Mapa).
- La landing nueva en un celular modesto: que el movimiento no se trabe.

## Cómo se trabaja (acordado con Julieta el 2026-11-13)

Está en [`CLAUDE.md`](../../CLAUDE.md), secciones «Ahorro de tokens» y «Git y
cierre de PR»: una conversación por etapa o por tanda, quien coordina diseña
y decide, los arreglos y las revisiones de pantalla van en un modelo más
barato, y un arreglo con CI y Security en verde, revisión independiente
aprobada y prueba en la app se mergea y se avisa después.
