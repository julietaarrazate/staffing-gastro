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

- ✅ **Panel del comercio** (`C-Panel`, `C-Panel-vacio`, `C-Panel-nadie`) · #706 · [historial](../historial/2026-11-20-panel-comercio-direccion-suave.md) · con piezas propias (`employer/CieloPanel`, `employer/TurnoPanel`); `ShiftCard` no se tocó · quedaron afuera «Buscamos hace N min», las fotos de quienes se postularon y las tres salidas de «nadie se postuló» (subir el pago, invitar a un favorito, cambiar el horario): son funciones nuevas

- ✅ **Perfil de quien trabaja** (`T-Perfil`) · #705 · [historial](../historial/2026-11-20-perfil-trabajador-direccion-suave.md) · con una pieza propia (`components/worker/PerfilTrabajador.tsx`); el perfil del comercio, `/profile/edit` y `/profile/settings` no se tocaron; quedaron afuera quién escribió la reseña, «puntual en N» y las filas «Experiencia y CV», «Zona y puestos» y «Avisos y apariencia» (son funciones nuevas)

- ✅ **Mapa** (`T-Mapa`) · #707 · [historial](../historial/2026-11-20-mapa-direccion-suave.md) · quedaron afuera el conmutador Lista / Mapa, los chips de día y la tarjeta única con «Ver el turno» (son funciones nuevas); falta mirar el mapa de noche con el mapa real

- ⬜ **«¡Oído!» al postularse, a pantalla entera** (`T-Oido`) · es una función nueva, no piel: hoy es la cinta sobre la hoja del turno

- ✅ **La barra de abajo y el encabezado** (`.barra`, `.barra-comercio` y `.mas` en `oido.css` del lienzo) · #712 · [historial](../historial/2026-11-20-barra-flotante-y-encabezado.md) · la barra flota, sin franja de encabezado en el celular («oído» y la campanita sobre el cielo del Inicio y del Panel; en las demás, la cuenta de avisos va en esa pestaña) y «Publicar turno» del comercio es el «+» azul hondo; en la compu, la misma píldora arriba · quedó afuera juntar Buscar y Mapa en una pestaña (seis → cinco, con el conmutador Lista / Mapa): es una función, va aparte y después

- ✅ **Buscar y Mapa en una pestaña** (el conmutador Lista / Mapa de `T-Buscar` y `T-Mapa`) · #713 · [historial](../historial/2026-11-21-buscar-y-mapa-una-pestana.md) · cinco pestañas (Inicio, Buscar, Turnos, Chats, Perfil), «Matches» pasó a «Turnos» · quedaron afuera el filtro compartido entre lista y mapa y los chips de día (son funciones nuevas)

## Sin maqueta todavía

- ✅ **Editar perfil, Datos del comercio y Ajustes** (`app/profile/edit`, `app/profile/settings`) · #711 · [historial](../historial/2026-11-20-editar-perfil-y-ajustes-direccion-suave.md) · sin maqueta: con las piezas de Publicar turno y del Perfil; del formulario del comercio se migró la cáscara y los campos, no el mapa de la dirección ni las fotos

- ⬜ **La bienvenida y el ingreso/alta** (hoy «con relieve», #680)

- ⬜ **La landing** (`components/landing/`, estilos `.landing-*`) · es la híbrida del 2026-11-18, anterior a la dirección suave: conserva los botones con relieve (los negros), el cielo y las nubes de antes y los títulos de sección en serif · **prueba hecha el 2026-11-21, sin decidir** (Julieta la vio y dijo «lo que quede mejor con la app, la landing lo vemos después»): el cielo y las nubes de la app, botones suaves con el principal en ámbar, títulos de sección en la letra de la app, tarjetas con sombra difusa y la sección de quien trabaja en azul hondo; se quedan la brocha del inicio, el cierre y la carta, la rueda de fotos, la comanda y el filete. El cambio está guardado como parche en [`design-system/pruebas/2026-11-21-landing-suave.patch`](../design-system/pruebas/2026-11-21-landing-suave.patch) (`git apply` sobre `main`). Quedó por decidir: si el botón principal va en ámbar (convive con la palabra ámbar del inicio) o en azul hondo, y si los títulos de sección dejan la serif. Va junto con la bienvenida y el ingreso

- ✅ **Buscar del comercio** (`app/search/page.tsx`) · #717 · [historial](../historial/2026-11-21-buscar-comercio-direccion-suave.md) · sin maqueta: gemela de `/map` (el mapa es el cielo, filtros de vidrio, pines y filas de personas); quedó afuera: el mapa real no se vio (sin mosaicos en la sesión)

- ⬜ **Las hojas compartidas** (`BottomSheet`, «¡Turno publicado!»)

- ✅ **Mi plan** (`app/subscription/page.tsx`) · #715 · [historial](../historial/2026-11-21-mi-plan-direccion-suave.md) · sin maqueta: con `SubpaginaSuave`; un solo botón ámbar (`accionesDelPlanActual` y `planDestacado` en `lib/subscription.ts`); textos y precios sin cambios

- ✅ **Favoritos y Soporte** (`app/favorites`, `app/support`, `app/support/[id]`) · #716 · [historial](../historial/2026-11-21-favoritos-y-soporte-direccion-suave.md) · sin maqueta: con `SubpaginaSuave`; de paso, las tarjetas de Favoritos ya no se salen de la pantalla con un nombre largo

- ✅ **Fichas** (`/workers/[id]`, `/companies/[id]`) · #718 · [historial](../historial/2026-11-21-fichas-direccion-suave.md) · sin maqueta: cada ficha es lo que la persona ve en su propio perfil, visto desde afuera (`FichaSuave`); «Agregar a favoritos» y «Cómo llegar» en azul hondo, sin ámbar

- ✅ **Perfil del comercio** (`components/company/PerfilComercio.tsx`) · #714 · [historial](../historial/2026-11-21-perfil-comercio-direccion-suave.md) · sin maqueta: con las piezas del Perfil de quien trabaja; el título es el nombre del local y la reputación va en grande; el logo se cambia en «Datos del comercio»

- ⬜ **Administración** (`app/admin/`: Hoy, Turnos en vivo, Personas, Verificación, Soporte, Métricas, Crecimiento, Herramientas, Seguridad) · **decidido por Julieta el 2026-11-20:** toda la app pasa a la misma dirección, el admin también. Hoy conserva arriba el logo y la campanita en el celular porque sus pantallas no tienen cielo (#712); al migrarlo se decide si lleva cielo

- ⬜ **Cierre:** las reglas de `.estilo-suave` pasan a `:root` y se borra lo «con relieve» que quede en la app (ADR-0028, punto 6)

## Pedidos de Julieta sobre pantallas ya migradas (2026-11-21)

Los vio en su celular, con capturas. Son funciones o rediseños, no piel: van
en una tanda propia, una pantalla por PR.

- ⬜ **Mis turnos: tocar un día de la tira** · hoy la tira de la semana no se toca y debajo va la lista entera. Propuesta: tocar una fecha muestra sólo los turnos de ese día (tocarla de nuevo vuelve a la semana), puntito en los días con turnos y flechas para cambiar de semana, así los terminados viejos no son una lista infinita.

- ⬜ **Panel del comercio: el renglón «Todos / Buscando (0) / En marcha (0) / Terminados (2) / Cancelados»** · le resulta poco estético: largo, palabras sueltas, y el Panel queda menos prolijo que Mis turnos. **Decidido por Julieta el 2026-11-21:** se sacan las pestañas (la lista ya va agrupada con sus títulos) y va la misma tira de días de Mis turnos; el comercio toca un día y ve lo de ese día, ordenado por estado.

- ⬜ **El ícono del asistente («¿Qué necesitás?»)** · las estrellitas son genéricas. Propuesta: un dibujo propio de la marca (la «o» de oído, la del ícono de la app).

- ⬜ **La app instalada a veces muestra la versión anterior** · sin confirmar la causa: lo más probable es que la app abierta en segundo plano siga con el código que cargó (el service worker no guarda páginas). Propuesta: detectar que hay versión nueva y recargar al volver al frente.
