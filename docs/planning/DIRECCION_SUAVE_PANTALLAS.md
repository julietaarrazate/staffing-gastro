# La dirección suave, pantalla por pantalla

Qué pantalla ya pasó a la dirección suave ([ADR-0028](../adr/ADR-0028-direccion-suave.md))
y cuál falta. Las maquetas son los archivos `project/*.dc.html` del lienzo
«Oído · identidad por pantalla» (https://claude.ai/artifact/WJn8NkYTpvSsa81RpoR2Jg);
qué responde cada pantalla está en
[`design-system/direccion-relieve.md`](../design-system/direccion-relieve.md),
«Identidad por pantalla».

**Cómo se edita (para que dos sesiones en paralelo no choquen):**

- Cada pantalla es **un renglón, separado del siguiente por una línea en
  blanco**. El PR de una pantalla cambia sólo su renglón: el estado, el número
  de PR y el link a su historial. No se reordenan ni se juntan renglones.
- El PR de una pantalla **no toca el párrafo de la etapa 4 de
  `docs/STATUS.md`** ni las listas compartidas de `direccion-relieve.md`. Lo
  que haya que cambiar ahí se hace una vez, al cerrar la tanda.
- Qué va en paralelo: lo que no comparte piezas. Van **una después de la
  otra** Mis turnos y el Panel (comparten `ShiftCard`), y la barra de abajo y
  el encabezado van al final, solos (están en todas las pantallas).

## Con maqueta en el lienzo

- ✅ **Publicar turno y Publicar evento** · #682 · [historial](../historial/2026-11-19-publicar-direccion-suave.md)

- ✅ **Inicio de quien trabaja** (`T-Inicio-libre`, `T-Inicio-en-marcha`) · #696 y #697 · [historial](../historial/2026-11-19-inicio-trabajador-direccion-suave.md)

- ✅ **El turno** (`T-Turno`) · #699 · [historial](../historial/2026-11-20-detalle-del-turno-direccion-suave.md)

- ✅ **Candidatos y «¡Oído!» al elegir** (`C-Candidatos`, `C-Oido`) · #698 · [historial](../historial/2026-11-20-candidatos-y-oido-direccion-suave.md)

- ✅ **Mis turnos** (`T-Mis-turnos`) · #703 · [historial](../historial/2026-11-20-mis-turnos-direccion-suave.md) · con una pieza propia (`components/worker/TurnoSuave.tsx`); `ShiftCard` no se tocó

- ✅ **Buscar, de quien trabaja** (`T-Buscar`) · #702 · [historial](../historial/2026-11-20-buscar-trabajador-direccion-suave.md) · quedaron afuera el buscador de texto, el conmutador lista/mapa, los chips de día y la marca «Paga más» (son funciones nuevas)

- ✅ **Chats** (`Chats`) · #701 · [historial](../historial/2026-11-20-chats-direccion-suave.md) · sin las secciones por fecha del turno ni «Vos:» (piden datos que `GET /chats` no manda)

- ✅ **Panel del comercio** (`C-Panel`, `C-Panel-vacio`, `C-Panel-nadie`) · #706 · [historial](../historial/2026-11-20-panel-comercio-direccion-suave.md) · con piezas propias (`employer/CieloPanel`, `employer/TurnoPanel`); `ShiftCard` no se tocó · 2026-11-21: compacto y con la tira de días, sin pestañas ([historial](../historial/2026-11-21-panel-compacto-con-tira.md), #722) · quedaron afuera «Buscamos hace N min», las fotos de quienes se postularon y las tres salidas de «nadie se postuló» (subir el pago, invitar a un favorito, cambiar el horario): son funciones nuevas

- ✅ **Perfil de quien trabaja** (`T-Perfil`) · #705 · [historial](../historial/2026-11-20-perfil-trabajador-direccion-suave.md) · con una pieza propia (`components/worker/PerfilTrabajador.tsx`); el perfil del comercio, `/profile/edit` y `/profile/settings` no se tocaron; quedaron afuera quién escribió la reseña, «puntual en N» y las filas «Experiencia y CV», «Zona y puestos» y «Avisos y apariencia» (son funciones nuevas)

- ✅ **Mapa** (`T-Mapa`) · #707 · [historial](../historial/2026-11-20-mapa-direccion-suave.md) · quedaron afuera el conmutador Lista / Mapa, los chips de día y la tarjeta única con «Ver el turno» (son funciones nuevas); el mapa de noche se rehízo en azul noche capa por capa (2026-11-21, [historial](../historial/2026-11-21-mapa-de-noche-azul.md)); falta el visto bueno de Julieta

- ⬜ **«¡Oído!» al postularse, a pantalla entera** (`T-Oido`) · es una función nueva, no piel: hoy es la cinta sobre la hoja del turno

- ✅ **La barra de abajo y el encabezado** (`.barra`, `.barra-comercio` y `.mas` en `oido.css` del lienzo) · #712 · [historial](../historial/2026-11-20-barra-flotante-y-encabezado.md) · la barra flota, sin franja de encabezado en el celular («oído» y la campanita sobre el cielo del Inicio y del Panel; en las demás, la cuenta de avisos va en esa pestaña) y «Publicar turno» del comercio es el «+» azul hondo; en la compu, la misma píldora arriba · quedó afuera juntar Buscar y Mapa en una pestaña (seis → cinco, con el conmutador Lista / Mapa): es una función, va aparte y después · 2026-11-21: la barra lleva un velo (`.barra-app::before`, [historial](../historial/2026-11-21-barra-velo-y-mas-al-centro.md)) que esfuma en el fondo lo que pasa por detrás de la píldora, sólo en el hueco que la pantalla deja libre para la barra · 2026-11-21, decisión de Julieta («lo prefiero al centro»), **reemplaza lo decidido el 2026-11-20 (#712): «Publicar turno» ya no es un «+» al lado, es el «+» azul hondo en el centro de la píldora** (dos pestañas de cada lado, sobresale 10 px; quien trabaja y el admin igual)

- ✅ **Buscar y Mapa en una pestaña** (el conmutador Lista / Mapa de `T-Buscar` y `T-Mapa`) · #713 · [historial](../historial/2026-11-21-buscar-y-mapa-una-pestana.md) · cinco pestañas (Inicio, Buscar, Turnos, Chats, Perfil), «Matches» pasó a «Turnos» · quedaron afuera el filtro compartido entre lista y mapa y los chips de día (son funciones nuevas)

## Sin maqueta todavía

- ✅ **Editar perfil, Datos del comercio y Ajustes** (`app/profile/edit`, `app/profile/settings`) · #711 · [historial](../historial/2026-11-20-editar-perfil-y-ajustes-direccion-suave.md) · sin maqueta: con las piezas de Publicar turno y del Perfil; del formulario del comercio se migró la cáscara y los campos, no el mapa de la dirección ni las fotos

- ✅ **La bienvenida y el ingreso/alta** (`/login`, `/register`, `/recuperar`, `/restablecer`, `/verificar-email`, `/bienvenida`) · #721 · [historial](../historial/2026-11-21-acceso-direccion-suave.md) · sin maqueta: el cielo con el «oído» y el título, la hoja con el formulario (`components/acceso/PantallaAcceso.tsx`) · la landing queda en su renglón, aparte

- ⬜ **La landing** (`components/landing/`, estilos `.landing-*`) · es la híbrida del 2026-11-18, anterior a la dirección suave: conserva los botones con relieve (los negros), el cielo y las nubes de antes y los títulos de sección en serif · **prueba hecha el 2026-11-21, sin decidir** (Julieta la vio y dijo «lo que quede mejor con la app, la landing lo vemos después»): el cielo y las nubes de la app, botones suaves con el principal en ámbar, títulos de sección en la letra de la app, tarjetas con sombra difusa y la sección de quien trabaja en azul hondo; se quedan la brocha del inicio, el cierre y la carta, la rueda de fotos, la comanda y el filete. El cambio está guardado como parche en [`design-system/pruebas/2026-11-21-landing-suave.patch`](../design-system/pruebas/2026-11-21-landing-suave.patch) (`git apply` sobre `main`). Quedó por decidir: si el botón principal va en ámbar (convive con la palabra ámbar del inicio) o en azul hondo, y si los títulos de sección dejan la serif. Va junto con la bienvenida y el ingreso

- ✅ **Buscar del comercio** (`app/search/page.tsx`) · #717 · [historial](../historial/2026-11-21-buscar-comercio-direccion-suave.md) · sin maqueta: gemela de `/map` (el mapa es el cielo, filtros de vidrio, pines y filas de personas); quedó afuera: el mapa real no se vio (sin mosaicos en la sesión)

- ✅ **Las hojas compartidas** (`ui/Sheet`, `ui/Modal`, «¡Turno publicado!», los avisos de la campanita, el aviso flotante y el recorrido guiado; `BottomSheet` y `ConfirmOverlay` ya estaban bien) · #PR · [historial](../historial/2026-11-21-hojas-compartidas-suaves.md) · sin maqueta: cada capa lleva su propia `.estilo-suave` (se dibujan en un portal) y no depende de la pantalla de atrás; un solo ámbar por ventana (en una confirmación destructiva, ninguno: confirmar va en rojo); quedó afuera la landing, que no usa ninguna de estas piezas

- ✅ **Mi plan** (`app/subscription/page.tsx`) · #715 · [historial](../historial/2026-11-21-mi-plan-direccion-suave.md) · sin maqueta: con `SubpaginaSuave`; un solo botón ámbar (`accionesDelPlanActual` y `planDestacado` en `lib/subscription.ts`); textos y precios sin cambios

- ✅ **Favoritos y Soporte** (`app/favorites`, `app/support`, `app/support/[id]`) · #716 · [historial](../historial/2026-11-21-favoritos-y-soporte-direccion-suave.md) · sin maqueta: con `SubpaginaSuave`; de paso, las tarjetas de Favoritos ya no se salen de la pantalla con un nombre largo

- ✅ **Fichas** (`/workers/[id]`, `/companies/[id]`) · #718 · [historial](../historial/2026-11-21-fichas-direccion-suave.md) · sin maqueta: cada ficha es lo que la persona ve en su propio perfil, visto desde afuera (`FichaSuave`); «Agregar a favoritos» y «Cómo llegar» en azul hondo, sin ámbar

- ✅ **Perfil del comercio** (`components/company/PerfilComercio.tsx`) · #714 · [historial](../historial/2026-11-21-perfil-comercio-direccion-suave.md) · sin maqueta: con las piezas del Perfil de quien trabaja; el título es el nombre del local y la reputación va en grande; el logo se cambia en «Datos del comercio»

- ✅ **Administración** (`app/admin/`: Hoy, Turnos en vivo, Personas, Verificación, Soporte, Métricas, Crecimiento, Herramientas, Seguridad, y la vista del admin en `/profile`) · 2026-11-21 (#PR) · una cáscara para todo el admin (`components/admin/PantallaAdmin.tsx`): **cielo corto y liso, sin las nubes altas** (es una herramienta de listas y tablas), con el título sobre el cielo, y debajo la hoja con el menú del panel; en la compu la hoja aprovecha hasta 72 rem. Sin maqueta

- ⬜ **Cierre:** las reglas de `.estilo-suave` pasan a `:root` y se borra lo «con relieve» que quede en la app (ADR-0028, punto 6)

## Pedidos de Julieta sobre pantallas ya migradas (2026-11-21)

Los vio en su celular, con capturas. Son funciones o rediseños, no piel: van
en una tanda propia, una pantalla por PR.

### La tanda siguiente, ya vista en maqueta (2026-11-21)

Julieta vio las maquetas (dos vueltas de prototipos; el código, **que no se mergea** porque es de prototipo y rompe tests, quedó como parche de referencia en [`design-system/pruebas/2026-11-21-maquetas-tanda-5.patch`](../design-system/pruebas/2026-11-21-maquetas-tanda-5.patch), `git apply` sobre el commit `180710a` de `main`; las capturas no quedaron en el repo) y decidió lo que sigue. **Orden para construir, una pantalla por PR, en una sesión nueva:**

1. ✅ **«Urgentes» con cuenta regresiva en el Inicio de quien trabaja** · arriba de la hoja, una fila horizontal con los turnos que empiezan en las próximas ~6 h: chip rojo «Empieza en 1 h 40» (se actualiza por minuto), el pago en grande, puesto, local y distancia. Sin urgentes, la sección no aparece. **Hecho** · #722 · [historial](../historial/2026-11-21-inicio-urgentes.md) · definido: «urgente» es la cercanía del horario (< 6 h), no la marca del comercio; sale de los turnos que el Inicio ya carga (mismo radio, sin los ya postulados), no trae nada de afuera; hasta 8 tarjetas.

2. ✅ **Mis turnos con la tira tocable** · #722 · [historial](../historial/2026-11-21-mis-turnos-tira-tocable.md) · tocar un día muestra sólo ese día (tocarlo de nuevo vuelve a la semana); puntito en los días con turnos; flechas para cambiar de semana, con puntito cuando hay turnos antes o después; «Volver a esta semana»; al final, el grupo «Más adelante» con filas de una línea que saltan a su semana. Día vacío: «Nada el martes 17».

3. ✅ **El ícono del asistente: la oreja** (decidido; hecho 2026-11-21, `OrejaIcon` en `components/icons.tsx`) · de trazo, en azul hondo, en el campo «¿Qué necesitás?».

4. ✅ **El Panel del comercio, compacto y con la tira** (decidido) · #722 · [historial](../historial/2026-11-21-panel-compacto-con-tira.md) · sin el renglón de pestañas; la lista agrupada por estado. El cielo más bajo, para que el primer turno se vea sin bajar: sin los tres contadores; «Evento» como chip chico junto al estado; la acción pendiente en una fila con el ámbar a la derecha; la tira debajo. **El número del cielo cuenta los turnos del día** (hoy por defecto; al tocar otro día, ese día): «Hoy tenés 3 turnos», con «1 sin cubrir» si hay; sin turnos hoy, «Hoy no tenés turnos» y el próximo. **Sin acción pendiente no va «Publicar turno» en el cielo** (queda el «+» de la barra); en el Panel vacío sí. «Más adelante» como en Mis turnos, con los «Buscando» primero. Mirado en la compu (dos columnas: lo que se elige a la derecha del título, la tira debajo).

5. ✅ **El mapa de quien trabaja** (2026-11-21, #722) · pines con el ícono del rubro y el pago; al acercar, el nombre del local en una pastilla del color de la tecla (se voltea a la izquierda si no entra); chips «Hoy», «Mañana», «Fin de semana» (uno a la vez) y «Paga más».

6. ✅ **Accesos por rubro en Buscar de quien trabaja** (hecho 2026-11-21, `.tecla-rubro` en `app/buscar/page.tsx`) · teclas con ícono y nombre en vez de los chips del cielo.

Quedó afuera, sin maqueta: el buscador de texto de turnos.

- ⬜ **La app instalada a veces muestra la versión anterior** · sin confirmar la causa: lo más probable es que la app abierta en segundo plano siga con el código que cargó (el service worker no guarda páginas). Propuesta: detectar que hay versión nueva y recargar al volver al frente.
