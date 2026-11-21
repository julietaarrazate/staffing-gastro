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

- ⬜ **Buscar del comercio** (`app/search/page.tsx`)

- ⬜ **Las hojas compartidas** (`BottomSheet`, «¡Turno publicado!»)

- ⬜ **Fichas, Favoritos, Mi plan, Soporte**

- ✅ **Perfil del comercio** (`components/company/PerfilComercio.tsx`) · #PR · [historial](../historial/2026-11-21-perfil-comercio-direccion-suave.md) · sin maqueta: con las piezas del Perfil de quien trabaja; el título es el nombre del local y la reputación va en grande; el logo se cambia en «Datos del comercio»

- ⬜ **Administración** (`app/admin/`: Hoy, Turnos en vivo, Personas, Verificación, Soporte, Métricas, Crecimiento, Herramientas, Seguridad) · **decidido por Julieta el 2026-11-20:** toda la app pasa a la misma dirección, el admin también. Hoy conserva arriba el logo y la campanita en el celular porque sus pantallas no tienen cielo (#712); al migrarlo se decide si lleva cielo

- ⬜ **Cierre:** las reglas de `.estilo-suave` pasan a `:root` y se borra lo «con relieve» que quede en la app (ADR-0028, punto 6)
