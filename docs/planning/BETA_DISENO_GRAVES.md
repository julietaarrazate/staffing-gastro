# Salida a beta, etapa 2 — diseño de los graves que faltan

> **Para qué sirve:** que quien arregle un grupo arranque de acá y no de una
> conversación. Es el diseño (qué se cambia, dónde, qué se prueba) de los 27
> grupos que el [tablero](./BETA_TABLERO.md) tenía «sin empezar» al
> 2026-11-13. El detalle de cada hallazgo (pasos, capturas, archivo y línea)
> sigue en el tablero privado de la etapa 1. **Al mergear un grupo se borra su
> sección de acá** (queda en el historial); si al implementar el diseño
> cambia, se corrige acá en el mismo PR.

**Cómo leerlo.** Un grupo = un PR. «Quién»: **C** lo hace quien coordina
(reglas del producto, modelo de datos, sesión), **S** va en Sonnet, **M** al
subagente `mecanico`. Las decisiones que el diseño necesitaba (10 a 15 del
tablero) las tomó Julieta el 2026-11-13; su criterio: cada decisión tiene
que servir para cubrir un puesto rápido, sobre todo en los urgentes. Las rutas de frontend son relativas a `frontend/`, las de backend a
`backend/app/modules/`.

## Orden y choques

Varios grupos tocan el mismo archivo; esos van uno detrás del otro, no a la
vez. Como mucho cuatro PRs abiertos.

| Ola | Grupos | Por qué en ese orden |
|---|---|---|
| A (✅ en `main`, 2026-11-14) | G1, G7, G5, G3 | Lo que más pesa en los 10 minutos y en la confianza; no se pisan entre sí |
| B (✅ en `main`, 2026-11-14) | G2, G16, G8, G9, G13, G24 | G2 después de G1 (`app/my-shifts/page.tsx`); G16 después de G7 (`next` en el ingreso) |
| C (reglas del producto, ya decididas) | G4, G6, G11, G14, G25 | G4 después de G1 y G5 (pantalla de candidatos) |
| D | G12, G15, G10, G17, G18–G23, G26, G27 | G15 después de G2 y G14 (`app/shifts/new/page.tsx`) |

Archivos con más de un grupo: `app/my-shifts/page.tsx` (G1, G2, G8, G9) ·
`app/shifts/new/page.tsx` (G2, G14, G15) · `lib/auth-context.tsx` (G7, G10,
G16) · `app/shifts/[id]/candidates/page.tsx` (G1, G4, G5, G24) ·
`shift/application/services.py` (G3, G4, G6, G25).

## Ola A

Los cuatro grupos de la ola A están en `main` desde el 2026-11-14 (G3 #562,
G5 #561, G1 #560, G7 #559).

## Ola B

Los seis grupos de la ola B están en `main` desde el 2026-11-14 (G13 #564,
G16 #565, G24 #566, G2 #567, G9 #569, G8 #571).

## Ola C

### G4 · La lista de postulantes dice quién sigue (U021, U123) — C

- Quien retiró su postulación no aparece
  (`application/infrastructure/repositories.py`, `list_by_shift_enriched`).
- Hoy, cuando alguien rechaza, cancela o falta, su postulación queda
  «aceptada»: nada lo registra. Estado nuevo `desasignada` con su motivo
  (`rechazo`, `cancelacion`, `ausencia`) en `application/domain/`; lo marcan
  `reject_assignment`, `worker_cancel` y `mark_no_show` por el puerto que ya
  usan. Migración Alembic (columna `motivo`), registrar en
  `tests/conftest.py`.
- En la pantalla, esas personas van al final, con su marca («Rechazó este
  turno», «Canceló», «No se presentó»), y se pueden volver a asignar.
- Antes de escribir: confirmar qué hace `ApplicationService.apply` con una
  postulación `aceptada` de un turno reabierto, y dejarlo coherente con
  `lib/applications.ts`.
- U123: al confirmar un turno, la app retira las otras postulaciones del
  mismo horario; se suma un solo aviso al trabajador que dice cuáles y por
  qué, y que puede volver a postularse si el turno confirmado se cae.
- Actualizar `docs/foundation/DOMAIN.md` y `NOTIFICATIONS.md`.


## Ola D

### G15 · El asistente de publicar no pierde lo cargado (U057, U135, BK-7DCC4AB945) — S

- La respuesta de la IA completa sólo los campos que la persona no tocó, y no
  salta de paso si ya avanzó.
- El paso va en la dirección (`?paso=`): «Atrás» vuelve al paso anterior. El
  borrador y su clave para no repetir el pedido se guardan en
  `sessionStorage` (se borran al publicar y al cerrar sesión). Lo mismo para
  los pasos de `/bienvenida`.


### G20–G23 · Descubrir y mapas (U069, U105, U071, U073) — S, un PR cada uno

- G20 `components/worker/SwipeDeck.tsx`: el toque abre el detalle sólo si no
  hubo arrastre.
- G21 `app/map/page.tsx`, `components/worker/MapSheet.tsx`: la cámara deja
  libre el alto de la hoja.
- G22 `components/map/MapView.tsx`, `components/employer/EnRouteMap.tsx`: el
  encuadre sigue a los dos puntos en cada actualización.
- G23 `app/search/page.tsx`: parte del local (`lib/company-place.ts`) y lo
  dice («Desde tu local»).
