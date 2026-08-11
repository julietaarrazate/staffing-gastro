# Esquema T1 de pulido integral (post-rebrand)

Autora del producto: **Julieta Arrazate**. Este documento es un spec de diseño
T1 **cerrado**: los ejecutores T2 implementan estos batches sin re-decidir la
dirección. Cada batch es un PR draft independiente, auditado G3 antes de merge.
Escrito 2026-07-19, tras el rebrand de #79 (cloche + landing premium).

## Ley de marca (vale para TODA la app, no solo la landing)

- **Marca**: la cloche (pomo + domo + plato) de `components/Logo.tsx`. Nunca
  recrear la geometría a mano: importar `Logo` / `LogoGlyph` / `LogoMark`.
- **Paleta**: primario `--color-primary #ff6b00` (fuerte `#e85f00`), tinta
  `#111`, papel `--color-paper #FBF8F4`, superficies blancas con borde
  `--color-line`. **Un solo acento por pantalla**: el naranja. Verde solo
  para éxito, rojo solo para peligro.
- **Prohibido**: gradientes multicolor decorativos (naranja→rojo,
  púrpura→índigo, etc.). El único gradiente permitido es el del tile de marca
  (`#ff6b00→#e85f00`) y overlays funcionales (p. ej. el oscurecedor de fotos
  de `OpportunityCard`).
- **Tipografía**: displays `font-extrabold tracking-tight`; cuerpo normal.
  Copy en voseo rioplatense, frases cortas, energía de app de consumo
  (referencia de registro: Pasito), nunca corporativo.
- **Radius**: generosos y consistentes (tarjetas `rounded-2xl/3xl`, chips y
  botones `rounded-full`). No introducir radios nuevos ad hoc.
- **Tagline oficial**: "Personal gastronómico, ya." (el "ya" en naranja
  cuando el medio lo permite). No inventar taglines alternativas.

## Batch C0 — Bugs reportados por la operadora (2026-07-19, prioridad sobre C1)

1. **Modo oscuro forzado**: la operadora vio la app "en modo oscuro" en su
   celular; la app solo diseña modo claro. Causa probable: auto-dark de
   Chrome Android invirtiendo colores. Fix: declarar `color-scheme: light`
   (`:root { color-scheme: light; }` en globals.css + `colorScheme: "light"`
   en el viewport/metadata del layout raíz) para que el navegador NO fuerce
   inversión. No implementar dark mode real (fuera de alcance).
2. **Selección de texto tipo página web**: dentro de la app se selecciona
   texto de UI al tocar/arrastrar. Fix: `user-select: none` en el chrome de
   la app (nav, botones, tabs, tarjetas interactivas, mapa) manteniendo
   seleccionable el contenido genuino (mensajes del chat, descripciones de
   turnos, páginas legales). Regla práctica: interactivo = no seleccionable;
   contenido de lectura = seleccionable.
3. **Mapa no responde hasta refrescar**: recién tras un refresh se puede
   hacer zoom/arrastrar. Investigar los componentes de mapa (MapView /
   LocationPicker / WorkerSearchMap): causa típica de Leaflet es inicializar
   en un contenedor sin tamaño final → `map.invalidateSize()` tras el mount
   y al cambiar el layout (ResizeObserver o `whenReady` + setTimeout).
   Reproducir con Playwright antes y después del fix.
4. **"Verificación" muerta junto a "Salir"**: hay un ítem de menú de
   verificación que no hace nada. Investigar qué era (¿verificación de
   identidad prevista?). Si no tiene backend: OCULTARLO (no dejar UI
   muerta) y registrar en el PR qué se ocultó y por qué; si tiene backend
   parcial, reportar el estado real antes de decidir.

Aceptación C0: capturas antes/después de cada fix; el mapa operable sin
refresh verificado con Playwright; grep de `user-select` documentando dónde
sí y dónde no.

## Batch C1 — Coherencia interna: que adentro sea igual de premium que afuera

Scope: componentes internos. Modelo: Sonnet. Un PR.

1. Gradientes off-brand a eliminar (hallados por grep en el audit de #79):
   - `components/ImageUpload.tsx`: `from-orange-400 to-red-500` → tile de
     marca (`from-[#ff6b00] to-[#e85f00]`) o primario sólido.
   - `components/ui/Avatar.tsx`: `from-orange-300 to-primary` → primario
     sólido o tile de marca.
   - `components/ui/EmptyState.tsx`: `from-orange-100 to-amber-100` →
     superficie neutra (`bg-surface`) con `LogoGlyph` naranja como icono
     cuando no se pasa uno específico.
   - `components/worker/WorkerGameCard.tsx`: chip `from-amber-100
     to-orange-100` → `bg-orange-50` sólido. El gradiente zinc del header es
     aceptable (es tinta, no multicolor).
2. `OpportunityCard`: darle `min-height` real al hero (hoy `flex-[1.15]` sin
   piso — se rompe en contenedores bajos, deuda registrada en #79).
3. `/register`: aceptar `?rol=comercio|trabajador` para preseleccionar la
   pestaña, y que los CTA de la landing lo pasen ("Necesito personal" →
   comercio, "Quiero trabajar" → trabajador).
4. Formato de fecha/hora único en toda la app (el de `lib/datetime.ts`);
   cazar cualquier `toLocaleString` suelto.
5. Estados vacíos: todos con `EmptyState` + copy en voseo con energía (no
   "No hay datos": "Todavía no publicaste turnos. El primero tarda un
   minuto.").
Aceptación: `grep -rn "to-red-500\|to-amber-100\|from-orange-300" frontend/components` vacío;
tsc/build verdes; lint sin errores nuevos; capturas de perfil, feed, turnos,
registro con la disciplina de un acento.

## Batch C2 — Legales (términos, privacidad, autoría)

Scope: páginas nuevas + footer + registro. Modelo: Sonnet. Un PR.
**Nota T1**: las plantillas NO tienen valor legal hasta revisión profesional;
el PR debe decirlo y las páginas llevan fecha de "última actualización".

1. `/terminos`: intermediación (Staffya conecta comercios y trabajadores; NO
   es empleador ni parte de la relación laboral/comercial entre ellos),
   cuentas y edad mínima (18), publicación y postulación, cancelaciones,
   reputación (reseñas honestas, sin manipulación), suscripciones del
   comercio (planes, renovación, baja), conducta prohibida, limitación de
   responsabilidad, ley aplicable argentina y jurisdicción.
2. `/privacidad`: qué datos se recopilan (cuenta, perfil, ubicación SOLO
   durante check-in/out de turnos, mensajes del chat), para qué se usan,
   **"No vendemos tus datos. Nunca."** como principio destacado, base legal
   Ley 25.326 de Protección de Datos Personales + derechos de acceso,
   rectificación y supresión (AAIP), almacenamiento (localStorage para la
   sesión, sin cookies de terceros ni trackers publicitarios), contacto.
3. Autoría: footer con "© 2026 Julieta Arrazate — Staffya" + enlaces a ambas
   páginas desde el footer de la landing y de la app.
4. Registro: checkbox obligatorio "Acepto los Términos y la Política de
   Privacidad" con links (sin marcar → botón deshabilitado). Backend NO
   cambia (el consentimiento se exige en UI; persistirlo es batch futuro).
Aceptación: páginas estáticas prerenderizadas, mobile-first, estilo de la
landing (papel/tinta), tsc/build verdes, capturas.

## Batch C3 — Confianza y conversión

**Resuelto 2026-08-11** (CLAUDE.md lo tenía marcado "sin arrancar" — quedó
desactualizado; al auditar de nuevo, 3 de los 4 puntos ya estaban hechos por
trabajo de otras sesiones, sólo faltaba uno):
1. **SEO — ya estaba hecho.** `app/sitemap.ts` + `app/robots.ts` existen,
   con `generateMetadata`/`metadata` en `layout.tsx` (root), `turno/[id]`,
   `terminos` y `privacidad`.
2. **Skeletons — faltaba `/profile`.** `/feed` (`CardSkeleton`/
   `CardSkeletons`), `/shifts` y `/my-shifts` ya usaban el mismo estilo de
   skeleton. `/profile` mostraba un `<Spinner>` centrado tapando toda la
   pantalla (pop-in brusco al terminar) — cambiado a un skeleton con la
   forma aproximada del layout real (título + tarjeta de header + tarjeta
   de formulario + panel lateral), mismo criterio del resto de la app.
   `/admin` también tiene un `<Spinner>` en su primer render, pero es el
   guard de sesión (`useRequireAuth`, común a las 13 pantallas protegidas,
   antes incluso de saber el rol) — no el de datos, que ya usa
   `StatCardSkeleton`/`AdminUserRowSkeleton`; se dejó como está.
3. **Estados de error — ya estaba hecho.** El patrón `EmptyState` con
   `primaryAction` de retry es el estándar ya usado en toda la app (varios
   PRs de esta misma sesión lo extendieron, no lo crearon).
4. **A11y — ya estaba hecho** por F4 (`docs/TECH_DEBT.md`): `jsx-a11y`
   `recommended` completo activado en `eslint.config.mjs`, 16 errores reales
   corregidos (labels de formulario, tarjetas de turno sin soporte de
   teclado). No se corrió Lighthouse (fuera del alcance de esta sesión) —
   pendiente si hace falta el número exacto.

~~Scope original: metadata + estados de carga. Modelo: Sonnet. Un PR.~~
~~1. SEO: `sitemap.ts` + `robots.ts` de Next, metadata por página pública~~
~~   (landing, /turno/[id], legales), OG específico por página.~~
~~2. Skeletons coherentes en feed, turnos y perfil (un solo estilo de~~
~~   skeleton), en vez de spinners mixtos.~~
~~3. Estados de error unificados (patrón de `EmptyState` con retry).~~
~~4. A11y: contraste AA en chips naranjas sobre papel, focus-visible en todos~~
~~   los interactivos, `aria-label` en icon-buttons.~~
~~Aceptación: Lighthouse a11y ≥ 95 en landing (correr con los browsers ya~~
~~provistos), tsc/build verdes.~~

## Batch C4 — Primera experiencia (post-registro)

**Comercio: resuelto 2026-08-10** (auditoría de producto, disparado por una
referencia real que pasó Julieta de otra app del rubro). El trabajador ya
tenía `/bienvenida` (zona + oficio, 2 pasos); el comercio caía directo en
`/shifts` sin haber cargado nada. Ahora `/bienvenida` también atiende
`employer`: nombre+logo (logo opcional) → ubicación (`MapAddressPicker`,
reusa ADR-0006) → termina en `/shifts/new` (primer turno guiado), no en un
panel vacío. 2 pantallas, no 3 — se dejó afuera el "nudge de completar
perfil" del borrador original por ahora (no bloqueaba nada concreto); se
puede sumar después si hace falta. Ver `frontend/app/bienvenida/page.tsx`.

**Trabajador + "tour guiado": resuelto 2026-08-10** (pedido explícito de
Julieta: el onboarding quedaba muy breve). `/bienvenida` del trabajador
suma un 3er paso opcional ("Contanos más de vos": foto + años de
experiencia). El "tour guiado" con tooltips que sí tiene la referencia
después del alta — dejado afuera a propósito cuando se resolvió el batch
de comercio, "mejor evaluarlo una vez que este wizard esté andando" — ya
está construido como `components/GuidedTour.tsx`: 3 globos al aterrizar en
`/feed` por primera vez (mazo de turnos, filtro de urgentes, tab
"Matches"), una sola vez por navegador. El comercio no lo tiene todavía —
ya cubre un rol similar con el wizard de publicar turno + la pantalla
"esto es lo que sigue"; sumarlo ahí es trivial si hace falta más adelante
(el componente es genérico, sólo necesita una lista de pasos nueva).

## Orden y reglas de ejecución

C2 (hecho, #81) → C0+C1 → C3 → C4 (C0 va con C1 en un mismo PR: legales es lo único bloqueante para usuarios
reales). Un ejecutor por batch, worktree aislado, PR draft, reporte honesto
con números; G3 del orquestador antes de merge. Los batches NO se mezclan.
