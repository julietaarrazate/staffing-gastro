# Los sellos de confianza dicen la verdad (G5: U038, U090, U108)

**Pedido:** salida a beta, grupo G5 (`docs/planning/BETA_DISENO_GRAVES.md`): un sello de confianza sólo aparece si el dato real lo respalda.

**Qué cambió:**
- Perfil del comercio (`frontend/app/profile/page.tsx`): ya no pinta «Identidad verificada» con `user.is_verified` (mail confirmado). Muestra «Comercio verificado» sólo con la constancia aprobada (claim `negocio_verificado` de `/identity/me`). `BusinessVerificationCard` ya pedía ese dato y ahora avisa por `onVerifiedChange`, sin pedirlo dos veces. El perfil del trabajador no pintaba el sello en el encabezado; su sello vive en `IdentityVerificationCard` y ya dependía de la identidad verificada.
- `frontend/components/worker/OpportunityCard.tsx`: «Comercio verificado» con `shift.company_verified`, igual que `ShiftCard` (debajo del nombre del comercio).
- Inicio en celular: `FeedHero` (chip junto al nombre del comercio) y `NearbyRow` (forma compacta: escudo con `aria-label`/`title` «Comercio verificado», porque 156 px no alcanzan para el texto), ambos con `shift.company_verified`, que ya viajaba.
- Postulantes del comercio: `ApplicantResponse.identidad_verificada` (`backend/app/modules/application/api/schemas.py`), calculado en `application/api/routes.py` con `VerificationService.verified_user_ids` inyectado (como `matching/api/routes.py`), en una sola consulta para todos. `EnrichedApplicant.user_id` sale del mismo JOIN que ya existía. La lista inline de `frontend/app/shifts/[id]/candidates/page.tsx` muestra `IdentityVerifiedBadge` (no usa `CandidateCard`, que es sólo de Recomendados y ya lo mostraba). El chip va con `whitespace-nowrap` y padding chico para no partirse ni ensanchar la tarjeta a 390 px.
- Pruebas: `backend/tests/test_application.py` (postulantes con y sin documento aprobado), `frontend/e2e/sellos-de-confianza.spec.ts`, `frontend/e2e/business-verification.spec.ts`.

**Por qué así:** un sello que se prende con el mail confirmado le dice al trabajador algo que no se revisó. Se descartó un campo nuevo en el perfil: el dato ya viaja en `/identity/me`.

**Queda abierto:** nada de este grupo.
