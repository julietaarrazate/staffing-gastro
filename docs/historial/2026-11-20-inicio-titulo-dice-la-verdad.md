# El título del Inicio dice la verdad: tu turno de hoy, cuánto falta, o si no hay nada (#697)

**Pedido:** Julieta miró el Inicio nuevo en su celular (2026-11-19) y dijo
«seguí con lo que pusiste»: el paso siguiente era la hora gigante. En su
captura además se veía una contradicción: el título decía «Hay turno a la
vuelta» y, justo abajo, «No hay más turnos cerca». Mandó referencias de
componentes de vidrio grueso «para el acento, o decime vos».

**Qué cambió:** el título del Inicio de quien trabaja (`/feed`) depende del
estado.

- **Tiene un turno aceptado hoy:** «Hola, Sofía. Hoy trabajás a las
  **20:00**», con el puesto y el local, y un botón «Ver mi turno» que lleva a
  Mis turnos (las acciones del turno siguen ahí, no se duplican).
- **Falta una hora o menos:** el cielo pasa a azul hondo y dice «Bartender
  en Bar Mirasol. Empezás en **28 min**». Se actualiza solo.
- **Ya empezó:** si marcó la llegada, «Estás en Bar Mirasol hasta las
  **23:00**»; si todavía no, «Tu turno en Bar Mirasol empezó a las
  **20:00**» (no se afirma que está en el local sin saberlo).
- **Hay turnos cerca:** «Hay turno a la vuelta». **No hay:** «Todo tranquilo
  por ahora». **Cargando:** un esqueleto en lugar del título.
- **Brillo de tecla**, sutil: el botón ámbar tiene una luz arriba y el vidrio
  sobre el cielo, un borde de luz. Sólo en las pantallas de la dirección
  suave (también se ve en Publicar turno).
- **El ícono del estado vacío** pasa de naranja a azul: junto a «Completar mi
  perfil» eran dos ámbar.

Técnico: `frontend/lib/inicio-estado.ts` (función pura `decidirInicio`, con
tests), `lib/use-ahora.ts` (reloj de 30 s; sólo corre si hay una postulación
aceptada), `components/worker/CieloInicio.tsx` (el cielo, extraído de
`app/feed/page.tsx`), `lib/datetime.ts` (`isTodayInArgentina` acepta el
«ahora»), `components/PerfilFaltanteCard.tsx` (prop `secundario`),
`components/ui/EmptyState.tsx` y, en `globals.css`, `.cielo-hondo`,
`.numero-gigante` y el brillo.

**Por qué así:**

- **Sin pedidos nuevos.** El turno de hoy sale de `GET /applications/mine`,
  que el Inicio ya pedía: la aceptada (`status === "aceptada"`) con su turno
  embebido. Se ignora si viene sin `shift` (pasa cuando el turno ya no existe
  o el comercio está suspendido, ADR-0024) y si el pedido falla: el Inicio
  nunca se rompe por esto.
- **«Ya no se trabaja»** son los estados terminales del backend
  (`finalizado`, `pagado`, `cancelado`, `no_cubierto`) más `check_out`.
- **El cielo hondo significa «algo está en marcha»** (lo decidido en la
  prueba de identidad): por eso aparece recién a una hora del turno.
- **Un solo ámbar:** con el turno de hoy a la vista, «Ver mi turno» es la
  acción; «Completar mi perfil» y el botón del vacío pasan a secundarios.
- **Del vidrio de las referencias se tomó el brillo, no el cristal.** El
  cristal grueso con reflejos de colores es un render 3D: imitado con código
  queda a medias y mete colores que rompen la regla del ámbar único.
- **Si el feed falla** y no hay turno de hoy, el título dice «Inicio»: ni
  «hay turno» ni «todo tranquilo» serían verdad.

**Revisión independiente** (otro agente; la primera pasada se perdió por un
reinicio del contenedor y se repitió). Confirmó que las horas no dependen de
la zona del celular (el backend manda los horarios con zona; probado a la
medianoche argentina desde UTC, Tokio y Los Ángeles), que no se agregan
pedidos y que el caché no muestra el turno de otra cuenta. Encontró, y se
arregló: una falla pasajera de `/applications/mine` en un refresco borraba el
turno de hoy del título (ahora se conserva lo último que se supo, también
para ocultar los turnos ya postulados); un turno que empieza en la próxima
hora pero pasada la medianoche no contaba; el título afirmaba «Estás en…»
sin llegada marcada; el reloj corría para cualquier postulación aceptada
(ahora sólo con un turno en las próximas 24 h); y los estados del turno van
por lista de permitidos (`asignado`, `confirmado`, `en_camino`, `check_in`,
`trabajando`).

**Queda abierto:** un turno de la madrugada (00:30) no aparece como «hoy
trabajás» la noche anterior, sólo desde una hora antes.  `/applications/mine` trae las últimas 50 postulaciones; un
turno aceptado hace mucho, con más de 50 postulaciones posteriores, no se
vería en el título (no se cambió el pedido). El resto de lo pendiente del
Inicio sigue en `design-system/direccion-relieve.md`, «En el código».
