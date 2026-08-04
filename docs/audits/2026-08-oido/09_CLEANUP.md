# 09 — Limpieza

> Fase 9 de la auditoría OÍDO. Cubre: dead code, TODO/FIXME, duplicados,
> archivos viejos, backups, código huérfano, dependencias sin uso, archivos
> temporales. **Regla del mandato: NO eliminar nada en esta fase** — cada
> hallazgo de código huérfano demuestra quién lo usa (o confirma que nadie
> lo usa) antes de proponer una acción, que queda para `13_ROADMAP.md`.
> Metodología: `grep` exhaustivo de cada símbolo candidato contra todo
> `frontend/app`+`frontend/components`+`frontend/lib`, verificando también
> rutas de import alternativas (barrel vs. directo) antes de concluir.
> Sin cambios de código en esta fase.

## 1. Buenas noticias primero: sin marcadores de deuda dispersa

`grep -rn "TODO\|FIXME\|XXX\|HACK"` sobre todo `backend/app` y
`frontend/app`+`components`+`lib` **no encontró ningún marcador real**
(las 2 coincidencias son la palabra española "todo"/"TODO" dentro de
comentarios normales, no anotaciones de deuda). El equipo usa
`docs/TECH_DEBT.md` como único lugar de deuda conocida en vez de dejar
comentarios `// TODO` dispersos por el código — es una práctica mejor
(deuda **rastreada y priorizada**, no perdida en el código), se destaca
como hallazgo positivo.

## 2. Sin archivos de backup/temporales versionados

`find` con patrones `*backup*`, `*.bak`, `*old*`, `*copy*`, `*.orig`,
`*tmp*` sobre el código fuente (excluyendo `node_modules`/`.venv`/
`__pycache__`) **no encontró nada**. Sin regresión respecto a lo que ya
confirmaba `docs/audits/AUDIT_REPORT.md` para la v1/v2 del Design System
(`PageState`/`SKILL_STYLES` ya eliminados, no dejados "por las dudas").

## 3. Corrección a `01_INVENTORY.md §7.4`: `playwright-report`/`test-results` no son un problema

La fase de inventario marcó como pendiente de verificar si esos directorios
estaban trackeados por git. **Verificado en esta fase: no lo están.**
Existe un `frontend/.gitignore` propio (distinto del `.gitignore` de la
raíz, que esta auditoría no había mirado hasta ahora) con
`/playwright-report/` y `/test-results/` explícitamente ignorados
(`frontend/.gitignore:17-18`). `git status`/`git ls-files` confirman cero
archivos trackeados bajo esos directorios. **No hay ninguna acción
pendiente acá** — son artefactos de ejecución local, correctamente
ignorados; se cierra el hallazgo abierto en la fase de inventario.

## 4. Código huérfano — 3 componentes del Design System sin ningún consumidor

Se revisaron los 17 componentes de `frontend/components/ui/` uno por uno
(exportados todos desde `index.ts`) buscando cualquier uso fuera de su
propia definición y del barrel, incluyendo imports directos que
saltearan el barrel (`from ".../ui/<Componente>"`) y usos por nombre
compuesto (para no repetir el error de un primer barrido, que marcó
`Toast` como huérfano por un `grep` con límites de palabra que no
capturaba `useToast`/`ToastProvider` — revisado de nuevo y confirmado que
`Toast` **sí** se usa en 8 pantallas, ver `app/layout.tsx:103` y cada
pantalla con `useToast()`).

**Confirmados sin ningún consumidor, ni directo ni vía barrel, en todo
`frontend/app`+`frontend/components`:**

| Componente | Archivo | Exportado desde | Usado en |
|---|---|---|---|
| `SearchInput` | `components/ui/SearchInput.tsx` | `ui/index.ts:10` | **Ninguna pantalla** |
| `FAB` | `components/ui/FAB.tsx` | `ui/index.ts:16` | **Ninguna pantalla** |
| `Chip` | `components/ui/Chip.tsx` | `ui/index.ts:3` | **Ninguna pantalla** |

- **`SearchInput`** y **`FAB`**: componentes del Design System construidos
  (probablemente en anticipación de un patrón de búsqueda/acción flotante)
  pero cuya pantalla de destino terminó resuelta de otra forma (`/search`
  usa un panel de filtros propio, no `SearchInput`; no hay ningún FAB en
  ninguna pantalla revisada en `07_FRONTEND.md`).
- **`Chip`** (`ui/Chip.tsx`): pill **interactiva y seleccionable** (botón
  con estado `active`, pensada para filtros por categoría, comentario del
  propio archivo: *"filtros tipo categorías de Morfi"*). No confundir con
  `StatChip` (`components/candidate/CandidateSignals.tsx:85`), un `<span>`
  **no interactivo** para mostrar un dato (distancia, puntualidad) en la
  tarjeta de candidato — visualmente similar (ambas son "pills"), pero
  semánticamente distinto (uno es control de filtro, el otro es texto
  informativo) y `StatChip` **no está exportado** (función privada del
  archivo, no forma parte del Design System) — no es una duplicación del
  mismo concepto, es una coincidencia de forma visual entre un componente
  del DS sin usar y un elemento visual local sin relación.
- **Ningún test** (backend ni E2E) referencia estos 3 componentes por
  nombre — confirmado con `grep` sobre `frontend/e2e/*.spec.ts`.
- **No se elimina nada en esta fase** (regla del mandato). Quedan
  candidatos documentados para `13_ROADMAP.md`: o bien se adoptan en una
  pantalla real (si hay uso previsto — p. ej. `Chip` en futuros filtros de
  `/search` o `/feed`), o se retiran del barrel en un PR dedicado y
  chico, con este documento como evidencia de que no rompen nada.

## 5. Dependencias — sin hallazgos de paquetes realmente sin uso

Se verificó cada dependencia de `frontend/package.json` contra imports
reales:

- `@sentry/nextjs` — **parecía sin uso** con un primer `grep` acotado a
  `app`/`components`/`lib` (0 resultados), pero se usa desde
  `frontend/instrumentation.ts` e `instrumentation-client.ts` (convención
  de Next.js para inicialización temprana, fuera del árbol de rutas/
  componentes) — **no está huérfano**, corrige un falso positivo del
  primer barrido antes de darlo por bueno.
- `maplibre-gl` — 0 imports directos en código de la app, pero es
  dependencia **peer** de `@vis.gl/react-maplibre` (10 archivos la usan) —
  uso indirecto correcto, no huérfana.
- `@types/supercluster` — paquete de sólo-tipos, nunca aparece en un
  `import` en tiempo de ejecución por diseño (aumenta los tipos de
  `supercluster`, que sí se importa en 1 archivo) — no huérfana.
- Resto (`lucide-react`, `motion`, `next`, `react`, `react-dom`,
  `supercluster`) con uso confirmado y no trivial.

**Conclusión: cero dependencias de `package.json` genuinamente sin uso.**
No se repitió el mismo ejercicio para `backend/requirements.txt` línea por
línea (son 15 paquetes, todos con un rol claro y ya inventariados en
`01_INVENTORY.md §6`; no se encontró indicio de ninguno sobrante durante
el resto de esta auditoría).

## 6. Veredicto de esta fase

El repositorio está genuinamente limpio en las categorías más comunes de
"basura acumulada" (sin TODOs perdidos, sin archivos de backup, sin
dependencias fantasma, sin artefactos de test versionados por error). El
único hallazgo real y accionable son 3 componentes del Design System
construidos y nunca adoptados por ninguna pantalla — bajo impacto (no
generan bugs, sólo superficie sin usar) y de remoción segura y barata el
día que se decida, con la evidencia de "quién lo usa" ya reunida acá tal
como pide el mandato de esta fase.
