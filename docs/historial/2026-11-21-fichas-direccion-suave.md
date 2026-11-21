# Las fichas públicas con la dirección suave (#718)

**Pedido:** Julieta, 2026-11-21: toda la app pasa a la dirección suave
(ADR-0028). Quedaban las fichas que ve el otro lado: `/workers/[id]` (la ve el
comercio) y `/companies/[id]` (la ve quien trabaja). Sin maqueta: cada ficha es
**lo mismo que la persona ve en su propio perfil, visto desde afuera**.

**Qué cambió (lo que se ve):** sólo la piel; qué datos hay y a quién se
muestran no cambia (es privacidad).

- **El cielo** con la vuelta en un botón de vidrio (misma lógica: `back()` y,
  sin historial, `/search`; el comercio no tenía botón de vuelta fuera del
  error), el nombre como título («Nombre, edad»; nombre del local) y debajo la
  ciudad (comercio: rubro · ciudad).
- **La foto o el logo redondo a caballo de la hoja** (sin foto, o si no carga,
  la inicial) y, en la ficha de la persona, el sello «Identidad verificada».
- **La reputación en grande** como en el perfil propio (nota, turnos hechos o
  publicados, puntualidad o pago a tiempo), con las mismas condiciones de
  antes; sin historia, «Nuevo en Oído». Las estrellas pasan al azul.
- **Persona:** bio, puestos como chips (sin colores por rubro), experiencia,
  nivel, disponibilidad, idiomas y certificaciones como filas, insignias como
  chips, «Ver CV» y «Descargar» quietos (sólo con `cv_kind`), reseñas debajo y,
  en la compu, en la columna de al lado. «Agregar a favoritos» (sólo comercio)
  es la acción: azul hondo; ya favorito, quieto con el corazón lleno.
- **Comercio:** la foto del local ancha y redondeada arriba de la hoja,
  descripción, «A cargo de …», capacidad, horario y dirección como filas, y
  «Ubicación» con el mapa y «Cómo llegar» en azul hondo; «Reportar un
  problema» (sólo quien trabaja) discreto al final. Ningún ámbar.
- Carga con la forma nueva (barra en el cielo, sin cambiar de texto) y error con
  «Volver».

**Lo técnico:** `components/profile/FichaSuave.tsx` (cáscara compartida),
`ReputacionGrande` y `DatoSuave` en `ProfileParts.tsx` (extraídos de los perfiles
propios, que ahora los usan: mismo aspecto), `WorkerReviews` con la prop `suave`.
`app/workers/[id]/page.tsx` y `app/companies/[id]/page.tsx` reescritas. Sin CSS
nuevo ni cambios de backend. `e2e/fichas-suaves.spec.ts` y ajustes en
`sin-nota-no-es-cero.spec.ts`.

**Por qué así:** extraer en vez de copiar el bloque de reputación y las filas
de datos evita dos versiones que se desfasen. Ver el logo también cuando hay
foto del local (antes el logo sólo era el respaldo) es el mismo dato público.

**Queda abierto:** Favoritos y Soporte. `RateMeter`, `RatingOrNew`,
`IdentityVerifiedBadge` y `SKILL_ACCENT` siguen para las pantallas sin migrar.

## Sin foto (2026-11-21)

**Pedido de Julieta:** «Lo que no me gusta son esos círculos de colores o tarjetas de colores en las fichas ni en ningún lugar donde el comercio o el empleado debe cargar fotos; en su defecto, cuando no lo cargan, debe tener algún componente visual estético que no se reduzca a un color plano liso.»

**Qué cambió:** pieza nueva `components/ui/SinFoto.tsx`: un pedacito de cielo (las clases `.portada-cielo`, `.portada-nube` y `.portada-tinta` de la portada de un turno, las mismas nubes, `variantePorId`) con una nube que asoma por abajo y la inicial encima. Llena su contenedor y escala con él (unidades de contenedor); por debajo de 36 px queda degradé e inicial. Bloque al final de `globals.css` (`.sin-foto`, la letra a `42cqmin` y la nube más tenue de noche).

**Dónde se usa:** las dos fichas (`FichaSuave`, con la prop `idFoto`), `PerfilComercio`, `PerfilTrabajador` (sin perfil cargado) y `ImageUpload` (el círculo de subir foto del perfil y el logo cuadrado de los formularios), `PersonaCerca` (`FotoPersona`), `TurnoPanel` (la persona asignada) y `Avatar` con la prop nueva `cielo` en Chats (lista y encabezado), Favoritos y las filas de Candidatos. **Sigue igual:** `Avatar` sin `cielo` (admin y landing), `OpportunityCard` y `ShiftCard` (los comparte la landing), los pines del mapa, `CandidatoDestacado` y `OidoElegido` (ya eran cielo hondo con iniciales), la foto del local (sin foto no se dibuja nada) y `app/profile/page.tsx` (el admin).

**Contraste de la inicial** (medido sobre los píxeles de la letra, 40/56/108 px, con nube): claro, peor caso 5,09; noche, 6,20.

**Verificación:** unit de `SinFoto`, ajustes en `ImageUpload.test`, `fichas-suaves`, `perfil-comercio-suave` y `panel-suave`. Capturas con fotos reales de `public/landing/` en el scratchpad de la sesión.

