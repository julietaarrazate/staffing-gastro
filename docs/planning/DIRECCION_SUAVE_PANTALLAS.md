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

- ⬜ **Panel del comercio** (`C-Panel`, `C-Panel-vacio`, `C-Panel-nadie`) · `app/shifts/page.tsx`, `components/ShiftCard.tsx` · después de Mis turnos

- ⬜ **Perfil de quien trabaja** (`T-Perfil`) · `app/profile/`

- ✅ **Mapa** (`T-Mapa`) · #PR · [historial](../historial/2026-11-20-mapa-direccion-suave.md) · quedaron afuera el conmutador Lista / Mapa, los chips de día y la tarjeta única con «Ver el turno» (son funciones nuevas); falta mirar el mapa de noche con el mapa real

- ⬜ **«¡Oído!» al postularse, a pantalla entera** (`T-Oido`) · es una función nueva, no piel: hoy es la cinta sobre la hoja del turno

- ⬜ **La barra de abajo y el encabezado** (`.barra` en `oido.css` del lienzo) · al final, solos; la barra flotante cambia una decisión del 2026-11-19 (hay que decidirla de nuevo)

## Sin maqueta todavía

- ⬜ **La bienvenida y el ingreso/alta** (hoy «con relieve», #680)

- ⬜ **Buscar del comercio** (`app/search/page.tsx`)

- ⬜ **Las hojas compartidas** (`BottomSheet`, «¡Turno publicado!»)

- ⬜ **Fichas, Favoritos, Mi plan, Soporte**

- ⬜ **Cierre:** las reglas de `.estilo-suave` pasan a `:root` y se borra lo «con relieve» que quede en la app (ADR-0028, punto 6)
