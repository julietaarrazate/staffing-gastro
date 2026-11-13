# Sin reseñas no es cero: nadie nuevo aparece con «0,0» (clave T3b, hallazgo U020)

**Pedido:** que quien todavía no tiene reseñas no se vea como mal puntuado: antes aparecía con «★ 0,0», cinco estrellas vacías o «Puntualidad 0 %», y un comercio apurado lo descartaba.

**Qué cambió:** sin reseñas no hay nota (ni estrellas vacías ni 0,0); sin turnos terminados no hay porcentaje de puntualidad; un comercio sin turnos publicados no muestra «Pago a tiempo». En su lugar va «Nuevo en Oído» (el rótulo que ya usaba la app) o nada. La regla vive en un solo lugar, `frontend/lib/reputation.tsx` (`hasRating`, `hasRate`, `formatRating` con coma, `formatRatingOrNone`/`formatRateOrNone` para tablas de admin, `NEW_LABEL`), y la línea «estrellas + nota» en `frontend/components/RatingOrNew.tsx`. La usan: chips de candidatos (`CandidateSignals.tsx`; además se arregló que alguien con turnos pero sin nota salía con ★ 0,0), perfil público del trabajador, perfil del comercio, Buscar trabajadores, pin del mapa (`WorkerMarker.tsx`), tarjeta del propio perfil (`WorkerGameCard.tsx`, sólo se oculta la nota) y la ficha de admin (dice «Sin reseñas» / «Sin datos»). La separación «· N eventos» ya no aparece con 0.

**Por qué así:** la API no manda la cantidad de reseñas, así que se trata una nota en 0 como «sin nota» (las notas van de 1 a 5, no hay 0 real). Con cantidad de reseñas sería más preciso, pero cambiaba el backend por un caso que el 0 ya resuelve. «Sin turnos terminados» se mide con `events_completed` (trabajador) y `events_published` (comercio, no hay conteo de pagos registrados). Un 0 % con turnos hechos se sigue mostrando: es un dato real.

**Tests:** `lib/reputation.test.ts`, `components/candidate/CandidateSignals.test.tsx`, `components/RatingOrNew.test.tsx` y `e2e/sin-nota-no-es-cero.spec.ts` (perfil público, candidatos, Buscar; persona nueva y con historial).

**Pago a tiempo (segunda tanda):** el backend ahora expone `payments_recorded` (contador que ya existía) en `CompanyProfileResponse` (`company/api/schemas.py`, que cubre el perfil público y el propio) y en la ficha de admin (`admin/api/schemas.py`, `dtos.py`, `services.py`). El front muestra «Pago a tiempo» sólo con `payments_recorded > 0` (`hasPaymentRate`); si el campo no viene (app vieja o caché) cae a los turnos publicados. Admin dice «Sin pagos». Test de API en `tests/test_attendance.py` (sin pagos 0, con pagos 1 y 2, perfil público) y spec E2E del comercio.

**Queda abierto:** si el backend pasa a mandar la cantidad de reseñas, `hasRating` debería usarla en lugar del 0.
