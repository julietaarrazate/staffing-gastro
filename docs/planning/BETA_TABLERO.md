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
| 1 | Probar de punta a punta, sin arreglar | ✅ cerrada: 142 hallazgos (3 bloqueantes, 79 graves, 60 menores). Entorno de prueba y estado escrito en #527 (🔵 abierto: espera el "sí" y una decisión sobre el aviso de GitGuardian) |
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

### Reporte externo de pruebas (7 de 9 en `main`)

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
| BK-898A15047291 | «Pagado hasta» queda viejo con la pestaña abierta | ⚪ va con U093 |

### Graves, agrupados por causa (un grupo, un PR)

De 79 graves: 20 ya están en `main` (los de la tanda 1 más U010, U011 y U053,
que entraron con el reporte externo); U094 y U137 quedan diferidos (dependen
del tope del plan, que está apagado en la beta).

**Tanda 1**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U032, U033 | Un turno reabierto (por rechazo, baja o ausencia) aparece en el Inicio, pero al abrirlo o compartirlo dice… (y 1 más de la misma causa) | ✅ en `main` | #537 |
| U015 | El aviso «Turno cerca tuyo» no lleva al turno: con Inicio abierto, tocarlo no hace nada | ✅ en `main` | #538 |
| U070 | Los avisos al celular salen sin margen de espera: si el celular no tiene señal en ese instante, el aviso pu… | ✅ en `main` | #539 |
| U009 | El aviso «Completamos todo…» tapa el botón «Publicar turno» unos 3 segundos | ✅ en `main` | #544 |
| U063, U085 | Inicio, Buscar y Mapa traen los 50 turnos más recientes de todo el país, sin filtrar por distancia: con más… (y 1 más de la misma causa) | ✅ en `main` | #547 |
| U058 | Evento: se publican turnos sin zona («Ubicación a confirmar») y los trabajadores cercanos no reciben aviso | ✅ en `main` | #546 (prueba en la app hecha el 2026-11-13) |
| U013, U014, U016 | El panel del comercio y la lista de candidatos no se actualizan solos (postulante nuevo, confirmación, rech… (y 2 más de la misma causa) | ⚪ sin empezar | «pantallas al día»: diseño en las notas de la sesión |
| U080 | Al reabrirse un turno por ausencia nadie recibe un aviso nuevo y, si ya empezó, tampoco vuelve al feed | ⏸️ espera decisión | avisar al reabrir: la parte de turnos ya empezados necesita ADR; hacerlo después de #547 |

**Tanda 2**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U004, U005 | Dos toques en «Llegué» marcan también «Me fui»: el turno queda terminado al llegar (y 1 más de la misma causa) | ✅ en `main` | #552 |
| U006, U007, U008 | En celular, dos toques en «Continuar» del paso de pago publican el turno sin mostrar el último paso (y 2 más de la misma causa) | ⚪ sin empezar |  |

**Tanda 3**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U019 | Marcar la llegada más de 15 min antes cuenta como impuntual: «Puntualidad 0 %» | ✅ en `main` | #549 |
| U020 | Quien todavía no tiene reseñas ni pagos aparece con «★ 0,0», «Puntualidad 0 %» o «Pago a tiempo 0 %» en rojo | ✅ en `main` | #551 |
| U079 | «No se presentó» se ofrece y se aplica sobre un turno que todavía no empezó, y penaliza al trabajador | ✅ en `main` | #550 |
| U081 | Se puede cancelar un turno cuyo trabajador ya terminó de trabajar (check-out hecho) | ⏸️ espera decisión | cancelar un turno ya trabajado: cambia el ADR-0007 |
| U082, U089 | Ausencia automática: al trabajador le dice «El comercio marcó que no te presentaste» y al comercio «sin que… (y 1 más de la misma causa) | ⚪ sin empezar |  |
| U076, U077, U078 | Cancelar un turno con postulantes no le avisa a nadie (y 2 más de la misma causa) | ✅ en `main` | #553 |
| U021, U123 | Quien retiró, rechazó, canceló o faltó sigue en la lista de postulantes con «Asignar», sin ninguna marca (y 1 más de la misma causa) | ⚪ sin empezar |  |

**Tanda 4**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U038 | El perfil del comercio muestra «Identidad verificada» con sólo confirmar el mail (incluso con la constancia… | ⚪ sin empezar |  |
| U090, U108 | El sello «Comercio verificado» no aparece en el feed ni en Buscar; sólo en el detalle del turno (y 1 más de la misma causa) | ⚪ sin empezar |  |
| U072 | El trabajador apaga «va en camino» y el comercio lo sigue viendo «en camino» hasta que marca la llegada | ⏸️ espera decisión | «va en camino» al apagar: modelo de privacidad |
| U023, U097, U095 | Se puede asignar a un trabajador suspendido: el turno queda «Esperando que confirme» para siempre (y 2 más de la misma causa) | ⚪ sin empezar |  |
| U112, U096 | Con la sesión vencida a mitad de publicar sólo sale «No autorizado» y la app no lleva a ingresar (y 1 más de la misma causa) | ⚪ sin empezar |  |
| U114, U115 | Si el servidor tarda en despertar al abrir la app, la persona con sesión ve la cabecera de visitante («Ingr… (y 1 más de la misma causa) | ⚪ sin empezar |  |

**Tanda 5**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U030, U031 | Los errores de validación salen como «Error inesperado» (mail sin dominio, texto corto, cantidad 51, mensaj… (y 1 más de la misma causa) | ⚪ sin empezar |  |
| U028, U029 | Mensajes de error con la fecha en formato técnico y tres horas corrida («el turno empieza el 2026-11-13T16:… (y 1 más de la misma causa) | ⚪ sin empezar |  |
| U138, U139 | Registrarse cuando la conexión ya llegó al límite de ingresos: la cuenta se crea, la pantalla dice «Demasia… (y 1 más de la misma causa) | ⚪ sin empezar |  |
| U093 | «Mi plan» con el cobro apagado: «9 de 5 turnos usados», «Alcanzaste el límite», «cambiá por $20.000/mes», a… | ⚪ sin empezar | va junto con BK-898A15047291 |

**Tanda 6**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U034, U035 | Si se corta la bienvenida (recarga, atrás, cerrar) la cuenta queda sin perfil y nada guía a completarlo; el… (y 1 más de la misma causa) | ⚪ sin empezar |  |
| U036 | Al elegir una dirección del buscador, la lista se vuelve a abrir y tapa el mapa y el pin | ⚪ sin empezar |  |
| U055, U056, U060 | Se puede publicar un turno con fecha pasada (queda «No cubierto» a los segundos), de 5 minutos o de 30 horas (y 2 más de la misma causa) | ⚪ sin empezar |  |
| U057, U135 | «Describí el turno» con la IA lenta pisa lo que la persona ya cargó a mano (y 1 más de la misma causa) | ⚪ sin empezar |  |
| U062 | Quien llega por un link (compartido o interno) y tiene que entrar o registrarse no vuelve a donde iba | ⚪ sin empezar |  |
| U054 | Con las notificaciones bloqueadas o si fallan, el interruptor de push no hace nada ni explica por qué | ⚪ sin empezar |  |

**Tanda 7**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U064, U104 | En compu, en Buscar y en el Mapa no se puede abrir el detalle del turno: uno se postula sin ver la descripc… (y 1 más de la misma causa) | ⚪ sin empezar |  |
| U065, U024, U025 | En Matches → Postulaciones las tarjetas no dicen de qué comercio es cada turno (y 2 más de la misma causa) | ⚪ sin empezar |  |
| U069 | En «Descubrir rápido», deslizar la tarjeta abre el detalle en vez de pasar al siguiente | ⚪ sin empezar |  |
| U105 | Mapa en celular: la hoja de tarjetas tapa los pines; al abrir sólo asoma la punta de un pin | ⚪ sin empezar |  |
| U071 | Mapa «va en camino»: el encuadre no sigue al trabajador y el punto queda cortado; a más de ~3 km no se ve n… | ⚪ sin empezar |  |
| U073 | «Buscar trabajadores cerca» no parte del local: mide desde el Obelisco o desde donde esté el celular | ⚪ sin empezar |  |
| U026, U075, U124 | En celular, con un nombre largo la tarjeta de candidato se sale de la pantalla y «Asignar» queda afuera (y 2 más de la misma causa) | ⚪ sin empezar |  |
| U083, U086 | El contador del evento «N/M cubiertos» no baja al cancelar y cuenta cancelados y asignados sin confirmar (y 1 más de la misma causa) | ⚪ sin empezar |  |

**Tanda 8**

| Hallazgos | Qué es | Estado | Dónde / nota |
|---|---|---|---|
| U125, U126, U127 | «Urgentes sin cubrir» en la portada del admin cuenta urgentes de cualquier día, no sólo de hoy (y 2 más de la misma causa) | ⚪ sin empezar |  |
| U128 | Los tickets no se pueden reabrir, y un mensaje del admin en un ticket cerrado le llega a la persona sin que… | ⚪ sin empezar |  |

### Lo que salió de las revisiones y no tiene hallazgo propio

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
- Tras abrir una confirmación del trabajador, durante 1 segundo los botones
  ignoran los toques sin avisar (#552).
- Postular y asignar: si falla el guardado del aviso, la acción queda hecha
  pero la respuesta es un error (salió de la revisión de #553).
- La puntualidad ya guardada de quien llegó temprano antes de #549 no se
  recalculó (es un promedio guardado; tocar datos de producción se pregunta).
- Evento: no existe cancelar varios turnos a la vez; quien se postuló a tres
  recibe tres avisos de cancelación.

### Decisiones que esperan a Julieta

Recomendación de quien coordina entre paréntesis (2026-11-13).

1. Texto de `/privacidad`: sumar que el identificador del dispositivo se
   borra también «al cerrar sesión en ese dispositivo» (#545 ya está en
   producción). Es texto legal: sube la versión. (Sí, junto con lo que salga
   del punto 3, para pedir que se acepte una sola vez.)
2. U081: qué pasa al cancelar un turno que ya se trabajó. (No permitirlo: con
   la salida marcada, el comercio finaliza y paga; un problema va por soporte.)
3. U072: «va en camino» cuando el trabajador lo apaga. (Que se apague al
   instante también para el comercio, que vuelve a ver «Confirmado».)
4. U080: reofrecer como urgente un turno reabierto que ya empezó. Desde #550
   pasa siempre: la ausencia sólo se marca con el turno empezado, así que el
   turno reabierto por ausencia nunca vuelve al Inicio. (Sí, hasta que termine
   su horario; falta decidir si se paga el turno entero o lo que resta.)
5. Si el ingreso de invitado sigue en la beta. (Apagarlo, salvo que se use
   para mostrar la app.)
6. #527: el "sí", el aviso de GitGuardian y, desde el 2026-11-13, un conflicto
   con `main`. (Sí; marcar el aviso como dato de prueba sin reescribir el
   historial, después de confirmar que el valor no es una clave real.)
7. Quien marcó la llegada temprano y se tiene que ir antes del inicio no
   puede cancelar ni marcar la salida hasta que el turno empieza (#552):
   ¿se permite cancelar desde «llegada marcada»?
8. ¿Los trabajadores ven cuántas cancelaciones tardías tiene un comercio?
   Hoy el dato viaja a cualquier usuario con sesión y ninguna pantalla lo
   muestra: o se muestra, o se deja de mandar.
9. Los 2 trabajadores de producción sin zona en el perfil (de 7) dejaron de
   recibir «Turno cerca tuyo» con #547 hasta que la carguen: ¿se les avisa?

Los puntos 2, 3 y 4 cambian decisiones ya escritas: cada uno lleva su ADR
antes del código.

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
