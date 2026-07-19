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

Scope: metadata + estados de carga. Modelo: Sonnet. Un PR.
1. SEO: `sitemap.ts` + `robots.ts` de Next, metadata por página pública
   (landing, /turno/[id], legales), OG específico por página.
2. Skeletons coherentes en feed, turnos y perfil (un solo estilo de
   skeleton), en vez de spinners mixtos.
3. Estados de error unificados (patrón de `EmptyState` con retry).
4. A11y: contraste AA en chips naranjas sobre papel, focus-visible en todos
   los interactivos, `aria-label` en icon-buttons.
Aceptación: Lighthouse a11y ≥ 95 en landing (correr con los browsers ya
provistos), tsc/build verdes.

## Batch C4 — Primera experiencia (post-registro)

Scope: onboarding. Modelo: Sonnet — pero el flujo exacto lo cierra T1 antes
de ejecutar (NO arrancar sin ese spec).
Idea a especificar: bienvenida por rol con 3 pantallas máx., nudge de
completar perfil (foto + zona = más candidatos/turnos), primer turno guiado.

## Orden y reglas de ejecución

C2 → C1 → C3 → C4 (C2 primero: legales es lo único bloqueante para usuarios
reales). Un ejecutor por batch, worktree aislado, PR draft, reporte honesto
con números; G3 del orquestador antes de merge. Los batches NO se mezclan.
