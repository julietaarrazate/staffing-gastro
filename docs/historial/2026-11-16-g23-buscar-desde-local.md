# «Buscar trabajadores cerca» parte del local del comercio (G23, U073)

**Pedido:** auditoría de interfaz, hallazgo U073. La búsqueda del comercio
(`/search`) medía desde el Obelisco o desde donde estuviera el celular, no
desde su local.

**Qué cambió:** con sesión de comercio, la búsqueda parte de la ubicación de
su local y la pantalla lo dice («Desde tu local · <dirección>», bajo el conteo,
en el panel de escritorio y en el sheet de mobile). Si el local no tiene
ubicación cargada no se busca desde ningún lado: aparece «Tu local no tiene
ubicación» con el botón «Completar ubicación» (lleva a `/profile/edit`), más un
enlace en el encabezado del sheet porque en mobile arranca replegado. El
comercio ya no le pide la ubicación al navegador. El trabajador (y el admin)
que comparte ubicación sigue midiendo desde donde está, sin cambios.

Técnico: `frontend/app/search/page.tsx` usa `useCompanyPlace` de
`frontend/lib/company-place.ts` (sin duplicar). El backend
(`matching/api/routes.py`, `GET /matching/search`, sólo employer/admin) ya
acepta `latitude`, `longitude`, `radius_km`, `skill`: no se tocó. El centro
derivado se memoiza (`useMemo`): sin eso el efecto de búsqueda se re-disparaba
en cada render. Tests: `frontend/e2e/search-desde-local.spec.ts` (local cargado,
local cargado con celular en otro lado, sin local, no comercio). Los specs
`available-now` y `search-sheet-overscroll` ahora mockean el perfil del
comercio con local.

**Por qué así:** medir en silencio desde el Obelisco devolvía resultados que el
comercio leía como «cerca de mi local». Se descartó ofrecer «usar mi
ubicación» como alternativa sin local: mezclaría dos orígenes en una pantalla
que tiene que decir uno solo.

**Queda abierto:** nada propio. El mapa sin local queda centrado en el Obelisco
(sin pines, sin búsqueda); si molesta, centrarlo en CABA con un zoom más
abierto.
