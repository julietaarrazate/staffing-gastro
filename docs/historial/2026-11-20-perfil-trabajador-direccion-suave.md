# El Perfil de quien trabaja con la dirección suave (#PR_PENDIENTE)

**Pedido:** Julieta, 2026-11-20: seguir la migración a la dirección suave
(ADR-0028) con el Perfil de quien trabaja, sobre la maqueta `T-Perfil` de la
prueba de identidad por pantalla (https://claude.ai/artifact/WJn8NkYTpvSsa81RpoR2Jg),
en una tanda de tres sesiones en paralelo (Panel del comercio, Perfil y Mapa).
«El cielo medio, con la foto de la persona a caballo de la hoja; en la hoja,
la reputación como número grande y una reseña, y el resto de los datos y
accesos de hoy como filas suaves.» Sólo la piel.

**Qué cambió:** `/profile` de quien trabaja. Qué datos se muestran y a quién
(CV, documentos, verificación de identidad), cuándo aparece cada cosa (sin
turnos hechos no hay métricas en cero; las cancelaciones y las ausencias se
ven desde la primera) y las acciones quedaron igual. El perfil del comercio y
el del admin no cambiaron: siguen en `app/profile/page.tsx` con la vista de
antes. `/profile/edit` y `/profile/settings` tampoco.

- **El cielo:** el nombre como título de la pantalla (se sigue editando
  tocándolo; antes el título era «Perfil» y el nombre iba en una tarjeta
  verde), debajo los puestos y la zona («Bartender y Mozo/a · Palermo, CABA»),
  el nivel en un chip de vidrio y, arriba a la derecha, un lápiz de vidrio que
  lleva a «Editar perfil» (antes era una fila con ícono).
- **La foto, a caballo de la hoja:** 108 px, con el borde del color de la
  hoja. Se sigue cambiando tocándola. Sin foto, la inicial va en celeste y
  azul hondo.
- **La reputación en grande:** la nota como el número más grande de la hoja,
  con las estrellas en azul (no en ámbar) y al lado «32 turnos hechos ·
  puntualidad 97%». Quien tiene turnos pero todavía no tiene nota ve en
  grande los turnos hechos. Sin turnos: «Tu reputación arranca con tu primer
  turno.», como antes.
- **Una reseña a la vista:** la más nueva que dice algo, con relleno de
  campo, sus estrellas y el día en palabras («14 de noviembre»; si es de otro
  año, lo dice). Las demás se abren ahí mismo con «Ver las N reseñas». Antes
  estaban todas en una tarjeta «Reseñas recibidas».
- **El resto, como filas:** «Ganado este mes» (con el total debajo),
  «Cancelaciones», «Ausencias» y «Años de experiencia» en un grupo; las
  insignias en chips; «Invitá a tu comercio» y «Ajustes» en otro grupo, sin
  íconos de colores. Los rubros dejaron de ser una sección: son la bajada del
  nombre.
- **La verificación de identidad:** sin aprobar va arriba, en una caja con
  relleno, con el mismo formulario y los mismos textos. Aprobada, el sello es
  un chip «Identidad verificada» junto a la foto y al pie de la hoja queda la
  nota de qué ven los comercios y qué se guarda.
- **Un solo ámbar:** «Estoy disponible ahora». Mientras el formulario de
  verificación está a la vista, el ámbar es «Enviar a revisión» y «Estoy
  disponible ahora» va quieto (relleno de la hoja, letra azul). El ícono de
  «Estás disponible ahora» pasó de ámbar a azul hondo, y el avatar sin foto y
  el ícono de las ganancias dejaron de sumar otro color.
- **En la compu:** el mismo cielo arriba y la hoja en dos columnas (la
  reputación, las reseñas y la verificación a la izquierda; «Disponible
  ahora», los datos y los accesos a la derecha).

Técnico:

- `frontend/components/worker/PerfilTrabajador.tsx` (era `WorkerGameCard.tsx`,
  que sólo usaba esta pantalla): la pantalla entera de quien trabaja, con
  `.estilo-suave` en la raíz. `app/profile/page.tsx` la devuelve para el rol
  `worker` y deja lo demás como estaba (se le sacaron las ramas del
  trabajador, que ya no llegan).
- `frontend/components/profile/ProfileParts.tsx`: `FilasSuaves`, `FilaSuave`
  y `Estrellas` (nuevas; `Row`, `RowGroup` y `SubpageHeader` no cambian).
- `frontend/components/ReceivedReviews.tsx`: `suave` muestra una reseña y
  despliega las demás; sin esa prop (el comercio) es la de siempre.
- `frontend/components/worker/IdentityVerificationCard.tsx`: `onStatusChange`
  (avisa el estado) y `sinSello` (aprobada, sólo la nota). Los textos
  secundarios pasaron de `text-ink/45…60` a `text-ink-soft`: sobre el relleno
  del campo no llegaban a 4,5.
- `frontend/components/worker/AvailableNowToggle.tsx`: `quieta` y las clases
  gancho `caja-suave`, `disponible-activo` y `boton-quieto`.
- `frontend/components/ImageUpload.tsx` (compartida con `/profile/edit` y
  `/bienvenida`): sólo suma la clase `foto-subir`; fuera del Perfil no pesa.
- `frontend/lib/datetime.ts`: `formatReviewDate`, con tests.
- `frontend/app/globals.css`: un bloque nuevo («El Perfil de quien trabaja
  con la dirección suave»), antes del de Mis turnos; no se tocó ninguna regla
  existente.
- `frontend/e2e/perfil-suave.spec.ts`: el cielo, la foto sobre el borde, el
  número grande, la reseña y el desplegable, los estados de la verificación
  con un solo ámbar, el nombre larguísimo a 320 px, el contraste en claro y
  en oscuro, y que el perfil del comercio sigue igual.

**Por qué así:**

- **El lápiz de vidrio es «Editar perfil» y la fila se fue:** dos accesos al
  mismo lugar en una pantalla era repetir. El nombre conserva su lápiz chico
  (editar el nombre es otra acción, que no está en el formulario).
- **«Ver las N reseñas» despliega acá:** no hay pantalla de reseñas, y
  hacerla era una función nueva. Así no se pierde ninguna reseña.
- **La zona debajo del nombre:** es un dato del propio perfil que esta
  pantalla no mostraba (sí el formulario). Va porque la pantalla responde
  «¿cómo me ven?» y la maqueta la trae; no cambia quién la ve.
- **«puntualidad 97%» y no «puntual en 31»:** el backend guarda la
  proporción, no la cuenta de turnos puntuales.
- **Sin la barra de puntualidad ni las fichas de colores:** la maqueta lleva
  el dato en el renglón de la reputación. El color por severidad (verde,
  ámbar, rojo) de la barra se fue con ella.
- **`PerfilTrabajador` en lugar de una pieza al lado de `WorkerGameCard`:**
  la tarjeta sólo vivía en esta pantalla; dejarla hubiera sido código muerto.

**Queda abierto** (está en la maqueta y no es piel, no se agregó):

- **Quién escribió la reseña** («Bar Mirasol · 14 de noviembre»):
  `GET /reviews/received` no manda el nombre del comercio. La reseña lleva
  las estrellas y el día.
- **«puntual en 31»** (la cuenta de turnos puntuales): el perfil trae la
  proporción.
- **Las filas «Experiencia y CV», «Zona y puestos» y «Avisos y apariencia»:**
  son entradas a partes de `/profile/edit` y `/profile/settings` que hoy no
  existen por separado. Quedaron las de hoy: el lápiz («Editar perfil»),
  «Invitá a tu comercio» y «Ajustes».
- **`/profile/edit` y `/profile/settings`** siguen con la piel anterior, y el
  perfil del comercio también (no tiene maqueta).
- **La barra de abajo flotante** de la maqueta: se migra al final, sola.
- **El esqueleto de carga antes de saber el rol** es el de siempre (plano):
  recién con la sesión se sabe si toca el cielo.
