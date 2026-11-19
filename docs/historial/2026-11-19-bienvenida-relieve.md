# La bienvenida con la dirección «con relieve» (beta, etapa 4)

**Pedido:** Julieta, 2026-11-19: «ni bien entrás como invitado a comercio o
empleado te muestra un onboarding con íconos de una cafetera desactualizada
que nada tiene que ver con lo actual, y es lo primero que el cliente carga
(el nombre de su comercio, los primeros pasos); hay que terminar de pulir
esas pantallas». Se adelantó en el orden. Se le mostraron dos opciones sobre
la pantalla real: arriba un **cielo con el «oído» fileteado**, o **sobria**
(el ícono chico, como estaba). Eligió el cielo, pero con el fileteado lo vio
«muy cargado»: quedó **el cielo con el «oído» plano**, el del encabezado de la
app.

**Qué cambió:** `/bienvenida`, para el comercio (tu comercio, ubicación) y
para quien trabaja (zona, oficio, tus datos). La lógica es la misma: qué se
pide, qué se guarda, a dónde lleva al terminar u omitir.

- **Arriba, el cielo con el «oído» plano.** Antes: el ícono chico sobre el
  papel y, en el primer paso, una cafetera en ámbar sobre un cuadrado oscuro.
- **Los pasos con palabras en un renglón**, como los de un turno: lo hecho
  tachado a mano en azul hondo, lo actual en negrita («Tu comercio ·
  Ubicación», «Zona · Oficio · Tus datos»). Antes, barritas en ámbar, y el
  ámbar es sólo la acción.
- **Las preguntas en brocha** («¿Cómo se llama tu comercio?», «¿Dónde querés
  trabajar?»…), la bajada en `ink-soft` y el formulario en una tarjeta lisa
  con filete (sin sombra difusa).
- **Los oficios son rectos**; el elegido, lleno en azul hondo (antes, píldoras
  con el elegido en ámbar).
- **«Subir foto»** (también en el perfil) pasa de ámbar a azul hondo, el color
  de los links. **«Usar mi ubicación actual»** del buscador de direcciones, recto;
  recién elegida una dirección se resalta en azul hondo, no en ámbar. El link
  «Volver a buscar en el mapa» pasa de `ink/40` a `ink-soft`, y con él las
  ayudas de ese mismo buscador que no llegaban a 4,5 (la revisión las midió
  entre 2,6 y 3,5): «¿No encontrás tu dirección? Cargala a mano», «Arrastrá el
  pin…», «También podés usar tu ubicación actual…», el barrio de cada
  resultado y la nota sobre el mapa vacío.

Técnico: `app/bienvenida/page.tsx` (`Shell` con `.app-cielo` y `Logo`,
`LETRAS_APP`; `StepDots` pasa a los pasos tachados con `.pasos-tachados`; se
fue `WelcomeIllustration` de esta pantalla), `components/ImageUpload.tsx` y
`components/map/MapAddressPicker.tsx`. Spec nuevo: `e2e/bienvenida-relieve.spec.ts`.

**Por qué así:**

- **El «oído» plano y no el fileteado:** Julieta, sobre la opción con el
  fileteado: «me gusta con el cielo, pero lo veo muy cargado». El fileteado
  queda para la pantalla de arranque y el final de la landing.
- **Los pasos tachados** son el mismo gesto que los pasos de un turno: lo que
  ya cargaste, tachado.

**Queda abierto:** Publicar turno y evento (adelantados a pedido de Julieta) y
el resto de las pantallas, en el ítem 0 de `STATUS.md`.
