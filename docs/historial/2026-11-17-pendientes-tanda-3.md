# Pendientes de la tanda 3 (etapas en azul, deshabilitados, guardas, flaky)

**Pedido:** cerrar lo que dejó abierto la tanda 3 de la beta (etapa 3).

**Qué cambió:**

- **Indicador de etapas** (`frontend/components/ShiftLifecycleStepper.tsx`): el
  paso actual pasa de `bg-primary` (ámbar, junto al botón ámbar de la tarjeta)
  a `bg-primary-text text-card ring-primary-text/20`, la misma receta que el
  círculo de comparar de Matches (#609); las líneas de progreso, de
  `border-primary/40` a `border-primary-text/40`. Contraste del número (`card`
  sobre `primary-text`): claro `#ffffff` sobre `#1c5478` 8,11; oscuro `#151d26`
  sobre `#9ac9e7` 9,62.
- **Botón desactivado** (`frontend/components/ui/Button.tsx`): `surface` y
  `ghost` ya no heredan `disabled:opacity-50`; `surface` desactivado es
  `bg-surface text-ink-mute` y `ghost` `text-ink-mute`, como `primary`.
  Contraste de `ink-mute` sobre `surface`: claro `#686572`/`#e5eef1` 4,83;
  oscuro `#8494a3`/`#1c2631` 4,92 (sobre el lienzo, 5,47 y 6,00). Antes, la
  tinta al 50% sobre la tarjeta blanca daba ~3,5. «Llegué» de Matches es
  `surface` desactivado y cambia solo.
- **Guardas de rol** con `useRequireAuth({ roles })` (U098): `/feed` sólo
  `worker`; `/search` `employer` y `admin` (el backend, `EmployerOrAdminDep`, y
  la barra del admin lo usan). Un rol equivocado va a la home de su rol y la
  pantalla no pide nada. Spec `frontend/e2e/guardas-feed-search.spec.ts`.
- **`descubrir-rapido.spec.ts:8` intermitente**: la causa estaba en el
  componente. `SwipeDeck` registraba el listener de flechas con `useEffect`
  (pasivo, después de pintar) y `go` cierra sobre `busy`: entre que el botón
  «Turno siguiente» se habilitaba y se registraba el listener nuevo, la flecha
  llegaba al viejo (con `busy` en true) y se perdía. Ahora es `useLayoutEffect`,
  que corre en el mismo commit que habilita el botón. Sin reintentos ni
  esperas fijas.

**Tras la revisión independiente:** la guarda de `/feed` y `/search` va en un
componente por fuera de la pantalla (`FeedGuard`, `SearchGuard`): con otro rol
(o sin conocer todavía el rol) la pantalla no se monta, así que no sale el
pedido del feed ni la búsqueda, no se pide la ubicación del navegador ni se
pinta el feed cacheado; además el efecto de geolocalización de `/search` sale
sin `token`. El spec de guardas afirma todo eso (con un contador sobre
`navigator.geolocation`) y suma admin en `/feed` → `/admin`. `SwipeDeck.test.tsx`
tiene un caso determinista de la flecha (MutationObserver sobre el botón que se
habilita; falla con `useEffect`, pasa con `useLayoutEffect`). El spec de
Matches busca el token exacto en el `classList` de la tarjeta, y el del
indicador mide colores calculados del paso actual y del completado en claro y
oscuro.

**Por qué así:** tokens y no literales; la regla (un ámbar por pantalla, lo
actual en azul, deshabilitado sin opacidad) quedó escrita en
`docs/design-system/marca-hoy.md`. El deshabilitado de `surface` queda en 4,8
o más, no en 3:1.

**Queda abierto:** los recordatorios enviados antes de #609 siguen abriendo
Matches sin resaltar el turno (no se puede arreglar hacia atrás).
