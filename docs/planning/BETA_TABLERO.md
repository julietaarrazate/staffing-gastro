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
| 3 | Que nada se vea descuidado (los 60 menores y lo que salió de las revisiones) | ✅ cerrada el 2026-11-17: grupos A a N, las diez decisiones de Julieta, M6 y los pendientes de las tres tandas (ver abajo) |
| 4 | Identidad, marca e isotipo | 🔵 Julieta eligió Shrikhand y ámbar (2026-11-17); letra, miniatura, vectores, manual en PDF y brand system en el PR de la marca; campanita en #622; ícono «el pinche con oído» (elegido el 2026-11-18, ya en el código). Sigue la dirección «con relieve» en la app, pantalla por pantalla (ver STATUS, ítem 0) |
| 5 | Lista de salida a beta | ⚪ (incluye la medición de los KRs: ver «Antes de abrir: medir la beta»; y pasar a TypeScript 7, el compilador en Go: PR aparte que sube `typescript` de 6 a 7 y corre tsc, lint, build y e2e; si ESLint con tipos se traba hasta la 7.1, ESLint sigue con TypeScript 6 mientras tanto. Decidido por Julieta el 2026-11-17) |
| 6 | SEO y GEO | ⚪ |

## Etapa 2

### Bloqueantes (3 de 3 en `main`)

| Qué | Estado |
|---|---|
| Pago con confirmación | ✅ #531 |
| El chat es del comercio con la persona asignada | ✅ #532 |
| Volver a postularse | ✅ #533 |

### Reporte externo de pruebas (9 de 9 en `main`)

| Reporte | Qué | Estado |
|---|---|---|
| BK-8D3E8C5C491E | Reintentar «Publicar» no crea otro turno (cubre U010 y U011) | ✅ #534 |
| BK-ACA2748DAFE3 | Ganancias sin tope de 500 turnos | ✅ #535 |
| BK-670B15B8C122 | Verificación enviada dos veces | ✅ #536 |
| BK-676ABE51EF2C | Guardar una parte del perfil no pisa el resto (cubre U053) | ✅ #540 |
| BK-0C3A2D8D7EE2 | Escape cierra una sola ventana | ✅ #541 |
| BK-8E9CFE08111D | Candidatos: error de carga no es «nadie se postuló» | ✅ #542 |
| BK-9FB6E2BC2226 | Avisos al celular: son de la cuenta con la sesión abierta | ✅ #545 |
| BK-7DCC7E4AB945 | Las claves para no repetir un pedido se pierden al recargar | ✅ #584 |
| BK-898A15047291 | «Pagado hasta» queda viejo con la pestaña abierta | ✅ #570 |

### Graves, agrupados por causa (un grupo, un PR)

De 79 graves: 73 ya están en `main` (los marcados ✅ abajo, más U010, U011 y
U053, que entraron con el reporte externo); U094 y U137 quedan diferidos
(dependen del tope del plan, que está apagado en la beta). El grupo G4
(U021, U123 y uno más) entró el 2026-11-18.

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
| U021, U123 | Quien retiró, rechazó, canceló o faltó sigue en la lista de postulantes con «Asignar», sin ninguna marca (y 1 más de la misma causa) | ✅ en `main` | #629 · G4, [ADR-0026](../adr/ADR-0026-postulacion-desasignada.md): estado `desasignada` con su motivo |

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
| U055, U056, U060 | Se puede publicar un turno con fecha pasada (queda «No cubierto» a los segundos), de 5 minutos o de 30 horas (y 2 más de la misma causa) | ✅ en `main` | #575 (revisión independiente y prueba en la app hechas el 2026-11-14) |
| U057, U135 | «Describí el turno» con la IA lenta pisa lo que la persona ya cargó a mano (y 1 más de la misma causa) | ✅ en `main` | #584 (prueba en la app hecha el 2026-11-16; cuatro revisiones independientes hechas el 2026-11-16; suite e2e completa en verde) |
| U062 | Quien llega por un link (compartido o interno) y tiene que entrar o registrarse no vuelve a donde iba | ✅ en `main` | #565 (prueba en la app hecha el 2026-11-14) |
| U054 | Con las notificaciones bloqueadas o si fallan, el interruptor de push no hace nada ni explica por qué | ✅ en `main` | #573 (revisión independiente y prueba en la app hechas el 2026-11-14; el permiso concedido no se puede probar sin pantalla) |

**Tanda 7**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U064, U104 | En compu, en Buscar y en el Mapa no se puede abrir el detalle del turno: uno se postula sin ver la descripc… (y 1 más de la misma causa) | ✅ en `main` | #579 (revisión independiente y prueba en la app hechas el 2026-11-14) |
| U065, U024, U025 | En Matches → Postulaciones las tarjetas no dicen de qué comercio es cada turno (y 2 más de la misma causa) | ✅ en `main` | #568 (prueba en la app hecha el 2026-11-14) |
| U069 | En «Descubrir rápido», deslizar la tarjeta abre el detalle en vez de pasar al siguiente | ✅ en `main` | #583 (prueba en la app hecha el 2026-11-16; revisión independiente hecha el 2026-11-16; probado con e2e en Chromium real, gesto a 390 px) |
| U105 | Mapa en celular: la hoja de tarjetas tapa los pines; al abrir sólo asoma la punta de un pin | ✅ en `main` | #582 (prueba en la app hecha el 2026-11-16; tres revisiones independientes hechas el 2026-11-16; probado con e2e: hoja a 390 px y cruce a 1280 px) |
| U071 | Mapa «va en camino»: el encuadre no sigue al trabajador y el punto queda cortado; a más de ~3 km no se ve n… | ✅ en `main` | #581 (prueba en la app hecha el 2026-11-16; revisión independiente hecha el 2026-11-16; probado con e2e en Chromium, sin el arnés: «va en camino» necesita una ubicación que se mueva) |
| U073 | «Buscar trabajadores cerca» no parte del local: mide desde el Obelisco o desde donde esté el celular | ✅ en `main` | #585 (prueba en la app hecha el 2026-11-16; revisión independiente hecha el 2026-11-16; probado con e2e: con local, sin local, perfil en 500 y trabajador) |
| U026, U075, U124 | En celular, con un nombre largo la tarjeta de candidato se sale de la pantalla y «Asignar» queda afuera (y 2 más de la misma causa) | ✅ en `main` | #566 (prueba en la app hecha el 2026-11-14) |
| U083, U086 | El contador del evento «N/M cubiertos» no baja al cancelar y cuenta cancelados y asignados sin confirmar (y 1 más de la misma causa) | ✅ en `main` | #577 (revisión independiente y prueba en la app hechas el 2026-11-14; en el arnés las cuentas nuevas no reciben avisos de cercanía, los cubren los tests) |

**Tanda 8**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U125, U126, U127 | «Urgentes sin cubrir» en la portada del admin cuenta urgentes de cualquier día, no sólo de hoy (y 2 más de la misma causa) | ✅ en `main` | #580 (revisión independiente y prueba en la app hechas el 2026-11-14) |
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
- «Descubrir rápido»: el toque y el arrastre de la tarjeta sólo se cubren con
  e2e; no hay test unitario del gesto (jsdom no dispara los de motion; salió
  de la revisión de #583).
- Asistente de publicar (#584): el formulario de evento (`/shifts/new-event`)
  todavía no guarda el borrador ni el paso; y el botón «Atrás» de la
  pantalla agrega una entrada al historial, así que «Atrás» del navegador
  después de usarlo vuelve al paso que se dejó.
- Mapa del trabajador: si la hoja cambia de altura mientras la cámara se
  mueve, el encuadre se acomoda de golpe al terminar el movimiento (no se
  desliza); y los grupos de pines cuentan con `getBounds()`, que no descuenta
  la hoja (salió de #582).
- Admin: la tarjeta «Urgentes sin cubrir» cuenta los urgentes abiertos que
  empiezan hoy (día argentino), pero la lista a la que lleva
  (`/admin/en-vivo?filtro=urgentes`) muestra también asignados y de otros
  días: los números pueden no coincidir (salió de la revisión de #580).

- G15 (#584), visto en la prueba en la app: si la persona pone el inicio a
  mano y la IA lenta propone otro día, la IA completa sólo el fin y queda
  antes del inicio. La pantalla lo marca («El fin tiene que ser después del
  inicio») y no deja seguir, así que no se publica nada roto.
- «Buscar trabajadores cerca» (#585) en celular, comercio sin local: con la
  hoja baja, el botón «Completar ubicación» del cuerpo queda detrás de la
  barra inferior. El link del encabezado sí se alcanza.
- Mapa del trabajador (#582): con la hoja estirada al máximo, tapa los pines.
  Es lo esperable al agrandarla a propósito; se anota por si molesta.

### Hallazgos nuevos de la prueba en la app (2026-11-14)

- ✅ **Grave: el pago con coma se multiplicaba por 100** (#590). «15000,50»
  publicaba $1.500.050. Ahora el monto es en pesos enteros: campo de texto
  con teclado numérico, el punto separa miles, la coma es decimal y se
  redondea al peso, y al salir se ve «15.001» (`lib/pesos.ts`,
  `components/ui/PesosInput.tsx`, en publicar y en el evento). Falta mirarlo
  en un celular real con teclado en castellano.
- **Menor: la distancia de «Llegué» sale en metros crudos** («estás a 274732
  metros»): conviene kilómetros arriba de 1000 m (#569).
- **Menor: en «Editar perfil», «años de experiencia» mayor a 80** frena con el
  aviso nativo del navegador (en inglés en algunos), no con uno propio.

### Para revisar con Fable (anotado el 2026-11-14)

La sesión del 2026-11-14 siguió con Opus 5.5 cuando se acabó el cupo de
Fable. Lo que sigue quedó para hacerlo o revisarlo con Fable, porque cambia
el modelo del dominio, un ADR vigente o un texto legal:

- ✅ **G4** (U021, U123): estado nuevo `desasignada` de la postulación, con
  migración (0051). Hecho el 2026-11-18 (#629,
  [ADR-0026](../adr/ADR-0026-postulacion-desasignada.md)).
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

## Etapa 3

Triaje completo (estado, tipo, evidencia en el código y archivos de cada
grupo) en [`BETA_ETAPA3_TRIAJE.md`](./BETA_ETAPA3_TRIAJE.md). De los 60
menores: 5 ya resueltos por los arreglos de la etapa 2 (U059, U116, U117,
U121, U087), 2 parciales (U130, U133), 10 esperan una decisión de Julieta y
2 quedan fuera (U141 va con el tope del plan, apagado en la beta; U102 se
cierra al apagar el ingreso de invitado, decisión 5).

**Arreglos, un PR por grupo** (tandas 1 a 4 en `main` el 2026-11-17, con
revisión independiente de cada PR; el resto ⚪ sin empezar):

| Grupo | Hallazgos | Tanda | Estado |
|---|---|---|---|
| A · Perfil del comercio | U119, U136 | 1 | ✅ #596 |
| B · Dirección, zona y mapa | U037, U040, U048, U049, U107 | 1 | ✅ #594 |
| C · Alta y verificación de mail | U041, U042, U043, U122 | 1 | ✅ #597 |
| F · Chat y soporte | U012, U017, U092, U099, U130 (U110 aparte: lleva migración) | 1 | ✅ #595 (U110 ✅ #623) |
| G · Candidatos, perfil y Buscar | U022, U027, U074 | 1 | ✅ #598 |
| I · Subidas de archivos y perfil del trabajador | U051, U052, U091 | 1 | ✅ #599 |
| K · Detalles sueltos de pantalla | U044, U046, U047, U061 | 1 | ✅ #600 |
| D · Mensajes de error y de límites | U113, U144 | 2 | ✅ #606 |
| L · Backend: robustez y privacidad menor | U100, U103, U118 | 2 | ✅ #604 |
| M · Admin: en vivo, ficha y «Ver como» | U129, U131, U132, U134 | 2 | ✅ #605 |
| H · Matches del trabajador | U066, U068, U088 | 3 | ✅ #609 |
| N · Guardas de rol y 2FA de admin | U098, U133 | 3 | ✅ #608, #611 |
| E · Textos y formatos unificados | U050, U067 | 4 (al final: toca muchas pantallas) | ✅ #620 |

**Pendientes de las tandas 1, 2 y 3: cerrados el 2026-11-17.**

- U110 (soporte: reportar un turno o un comercio) ✅ #623.
- `danger-text` en claro (#c22f2f, ≥ 4,5:1 sobre las superficies claras),
  «Garantía Oído» oculta con el turno cerrado y recorte de títulos y mensajes
  de aviso en un solo lugar ✅ #621.
- Textos de «sin conexión» y de límite unificados ✅ #620 (con el grupo E).
- Indicador de etapas en azul (un solo ámbar), deshabilitado legible, guardas
  de rol en `/feed` y `/search` y el e2e intermitente de «Descubrir rápido»
  ✅ #624.
- Un solo indicador de foco por campo (reporte de Julieta del 2026-11-18:
  bordes «verde y ámbar» encimados al tocar un campo) ✅ #627.

Quedan, a propósito, sin código:

- Zonas ya guardadas como «Mi ubicación actual» quedan sin selector
  precargado hasta que la persona elige una; no se migran (#594).
- Inputs a 16 px en celular (#600): mirar en un iPhone real que ningún
  formulario quede apretado (prueba de persona, etapa 5).
- Ficha de persona (admin): si dos personas faltan al mismo turno, sólo queda
  la última; un registro propio de ausencias lo resolvería, hoy no hace falta.
- «Turnos en vivo» con más de 200: lo que queda afuera es lo más viejo (y el
  aviso lo dice).
- Recordatorios enviados antes de #609 abren Matches sin resaltar el turno.

Los grupos de una misma tanda no comparten archivos; entre tandas sí (ver el
triaje). Los menores nuevos de la prueba en la app (sección de la etapa 2)
entran a la etapa 3 con estos.

**Decisiones de Julieta (2026-11-17)** sobre los que esperaban (preguntas
con opciones en el triaje; implementar sin repreguntar):

| Hallazgo | Decisión |
|---|---|
| U018 · aviso al trabajador al finalizar el turno | Sí, aviso nuevo en la campanita y por push: «Cerró tu turno · Calificalo» · ✅ #618 |
| U039 · Google sobre una cuenta con mail sin confirmar | Sigue reclamándola, más un mail de aviso al mail de la cuenta · ✅ #615 |
| U084 · cancelar un evento entero | Sí, un botón, con los mismos avisos y la misma penalidad por cancelación tardía que cancelar cada puesto · ✅ #617 |
| U101 · edad | Pedir fecha de nacimiento y bloquear a menores de 18 en el alta (cambia el flujo y sube la versión legal) · ✅ #616 (versión legal `2026-11-17-2`, con el «sí» de Julieta) |
| U106 · asistente y verificación | Se corrige la documentación: el asistente no responde por la verificación (Julieta sin preferencia; se tomó la recomendada) · ✅ `QUE_EXISTE_HOY.md`, en el cierre de la etapa |
| U109 · dorso del DNI | No: sigue frente y selfie |
| U111 · calificación | Definitiva; la pantalla lo avisa antes de enviar · ✅ #618 |
| U140, U142, U143 · tope del plan | Diferidos hasta encender el cobro, junto con U094 y U137 (ver la regla de cambio de plan, abajo) |

**Regla de cambio de plan (Julieta, 2026-11-17), para implementar antes de
encender el cobro**, junto con U140, U142 y U143. Es la práctica de la mayoría
de las suscripciones mensuales:

- **Subir de plan:** inmediato, pagando la diferencia entre los dos planes por
  los días que quedan del mes pago (un pago suelto más de Checkout Pro); la
  fecha de renovación no cambia.
- **Bajar de plan:** rige al vencer el mes pago, sin reembolso; hasta ese día
  sigue el plan actual.
- **El contador de turnos no se reinicia al cambiar:** lo usado en el mes
  cuenta contra el tope del plan nuevo (cierra U140).
- Hoy, con el cobro prendido, pagar otro plan a mitad de mes cobra el precio
  entero, suma los días y reinicia el contador: eso es lo que cambia.
- Pasarela: Mercado Pago. Stripe no abre cuentas a negocios de Argentina
  (sólo vía una empresa en EE. UU.); se revisa si Oído sale del país.

**Otras decisiones de la sesión (2026-11-17):** el plan elegido en la landing
se guarda sólo al terminar el alta (no en cualquier visita a «Mi plan»); la
pantalla `/shifts` del comercio se llama «Panel» en todos lados (#620); un
trabajador puede atar a un ticket de soporte cualquier comercio cuyo perfil
público ve (#623).

## Antes de abrir: medir la beta (anotado el 2026-11-17)

Los KRs del trimestre (objetivo 1: «demostrar que Oído funciona con locales
reales») alimentan la lámina de tracción del deck. Se revisó qué registra hoy
la app y qué muestra `/admin/metricas`. Son ítems para hacer antes de abrir la
beta, porque lo que no se mide desde el primer turno no se recupera después.
**M1 a M6 están hechos (2026-11-17); M7 sigue abierto.** La columna
«Qué hay hoy» describe cómo estaba antes de este cambio.

| KR | Qué hay hoy | Qué falta | Estado |
|---|---|---|---|
| Todos | Los conteos de **usuarios** excluyen las cuentas de prueba y las invitadas (`AdminService.get_stats`) | M1 · Las métricas de **turnos y comercios** no las excluyen: `count_period_stats`, `list_recently_filled`, `count_publication_stats` (`shift/infrastructure/repositories.py`) y `count_engagement_stats` (`company/`). Un turno publicado con «Ver como» o con la cuenta invitada del PIN cuenta como real. Excluirlas en las cuatro consultas | ✅ |
| Locales activos | «Comercios activos» = con al menos un turno publicado **en toda la historia**; «Comercios» = todos los que tienen perfil | M2 · Comercios distintos que publicaron en los últimos 7/30 días (y cuántos con al menos un turno cubierto), con el período anterior al lado, en `period-metrics` | ✅ |
| Turnos cubiertos | Sí, por 7/30 días (`period-metrics`) | M3 · «Cubierto» hoy es `first_assigned_at`: **el comercio eligió a alguien**, no que la persona confirmó ni que fue. Un turno rechazado o con ausencia queda contado como cubierto. Guardar cuándo confirma la persona (`Shift.confirm` no guarda la hora) y contar como cubierto el turno **confirmado**. Sumar **cumplido** = hubo check-in en el local (`Shift.check_in`, ya con ubicación), mostrado como % de los cubiertos. «Elegido por el comercio» queda como dato interno del embudo (ver la definición abajo) | ✅ |
| Tiempo de publicar a cubrir | Promedio y % en menos de 10 min por 7/30 días, medido de `published_at` a `first_assigned_at` | M4 · (a) medirlo de `published_at` a la **primera confirmación** (depende de M3); (b) separar los turnos para hoy o urgentes de los publicados con días de anticipación: uno publicado el lunes para el sábado no puede «cubrirse en 10 minutos» y mezclarlos ensucia la promesa; (c) mostrar la mediana además del promedio, que un solo turno lento mueve mucho | ✅ |
| Locales que repiten | «Comercios que repiten» = 2 o más turnos **publicados** / 1 o más, sin período (`events_published`) | M5 · Repetir después de que funcionó: de los comercios con un turno cubierto, cuántos publican otro dentro de los 30 días. Por período | ✅ |
| Locales que pagan o se comprometen | «Ingreso mensual recurrente» muestra 0 con el cobro apagado y aparte «Potencial si se cobrara». Con el cobro apagado toda suscripción se crea `activa` (`SubscriptionService`, línea 115), así que el potencial cuenta a todos los comercios | M6 · (a) El plan que el comercio elige en la landing vive sólo en el navegador (`lib/plan-elegido.ts`) y se borra al llegar a «Mi plan»: guardarlo en el servidor al darse de alta. (b) El compromiso de pago («precio fundador») no se registra en ningún lado: sumar un estado en Crecimiento (`lead`, hoy nuevo → … → alta) o un campo en la suscripción. (c) Al prender Mercado Pago, contar como «pagan» sólo los comercios con un pago aprobado | ✅ #619 |
| Para el deck | `period-metrics` sólo compara 7/30 días contra el período anterior; el ingreso es una foto sin historia | M7 · Una serie semanal desde el día 1 de la beta (o un CSV desde el admin) para la lámina de tracción. Puede esperar a después de M1-M6 | ⚪ |

**Hecho (2026-11-17), M1 a M5.**
[Historial](../historial/2026-11-17-medicion-beta-confirmado.md).

- **M1.** `count_period_stats`, `list_recently_filled`,
  `count_publication_stats` y la nueva `count_return_stats` reciben las
  cuentas de prueba e invitadas (`exclude_company_emails`) y las excluyen por
  el email del comercio. `count_engagement_stats` de comercios se eliminó.
- **M2.** `period-metrics` trae `active_companies` y `companies_with_covered`.
- **M3.** `shifts.first_confirmed_at` (migración 0046, sin backfill):
  `Shift.confirm()` la guarda sólo la primera vez. Cubierto = confirmado;
  cumplido = cubierto con `check_in_at`. El check-in no se borra al reabrir:
  el no-show sólo es posible antes de la llegada.
- **M4.** La promesa se mide de `published_at` a `first_confirmed_at`, en el
  período y en el total; mediana además del promedio; «con menos de 24 h de
  aviso» = `start_at - published_at <= 24 h`.
- **M5.** «Comercios que vuelven a publicar (30 días)» (`employer_return_30d_*`,
  reemplaza a `employer_repeat_*`): de los comercios con un turno cubierto,
  los que publican otro con `published_at` dentro de los 30 días siguientes a
  su primera confirmación. Sólo en la sección general, no por período.
- **Sin backfill:** lo confirmado antes de la migración 0046 no tiene hora de
  confirmación y no entra en las métricas de cobertura.

**Qué cuenta como cubierto (Julieta, 2026-11-17).** Un turno no está cubierto
porque el comercio eligió a alguien: falta que la otra parte acepte y vaya.
Se mide en dos pasos:

1. **Cubierto = la persona confirmó.** El tiempo de la promesa («menos de 10
   minutos») va de que se publica a la primera confirmación. No se mide
   hasta la llegada porque depende de la hora del turno (uno publicado a las
   18 para las 21 no puede «llegar» en 10 minutos).
2. **Cumplido = hizo check-in en el local.** Es la prueba de que el turno se
   hizo; se muestra como % de los cubiertos.

«Va en camino» no sirve de criterio porque es opcional (lo prende la
persona). «Elegido por el comercio» queda como dato interno, para ver dónde
se traba el embudo (elegir rápido y confirmar lento es un problema del lado
de quien trabaja).

## Cómo se trabaja (acordado con Julieta el 2026-11-13)

Está en [`CLAUDE.md`](../../CLAUDE.md), secciones «Ahorro de tokens» y «Git y
cierre de PR»: una conversación por etapa o por tanda, quien coordina diseña
y decide, los arreglos y las revisiones de pantalla van en un modelo más
barato, y un arreglo con CI y Security en verde, revisión independiente
aprobada y prueba en la app se mergea y se avisa después.
