# ADR-0003 — `quantity` del turno: un turno = una persona (decisión permanente)

**Estado:** aceptado · **Fecha:** 2026-07-02

## Contexto

`Shift.quantity` existía como campo desde el modelo original (hasta 100), pero
el dominio sólo soporta **un** `worker_profile_id` asignado por turno. Un
comercio podía publicar "necesito 10 mozos" y el sistema sólo cubría uno —
promesa incumplida hacia el comercio. Detectado en la auditoría v2
(`TECH_DEBT.md` P1) y mitigado en R1.4 capando `quantity` a `1` en la API y el
wizard, dejando la decisión de fondo (¿capar para siempre o construir
multi-asignación real?) pendiente.

## Decisión

**Un turno = una persona, para siempre.** No se construye multi-asignación
(tabla N–N de asignaciones, lógica de cupos parciales, UI de gestión por
cupo). El campo `quantity` se elimina del modelo en la próxima migración que
toque la tabla `shifts` por otro motivo (no amerita una migración dedicada
sólo para esto); mientras tanto queda fijo en `1` (`le=1` en `ShiftInput`).

**Cómo cubre un comercio un evento con varios puestos:** publicando **varios
turnos** (uno por persona/rol). El feed, el matching y las postulaciones ya
soportan esto sin cambios — es el patrón natural del dominio actual.

## Por qué

- El caso de uso real ("cubrir una posición eventual en < 10 min") es
  intrínsecamente 1 turno = 1 persona: el matching, el chat, el check-in
  geolocalizado y las reseñas ya modelan una relación 1:1 turno↔trabajador.
- Multi-asignación es una reescritura de dominio no trivial (SHIFT.md,
  MATCHING.md, CHAT.md, ATTENDANCE) por un caso de uso (eventos grandes) sin
  demanda demostrada hoy.
- "Varios turnos" para un evento grande ya funciona y es más simple de
  entender para el comercio (un turno, un estado, una persona).

## Consecuencias

- ✅ Cierra la deuda P1 de forma definitiva, no como parche temporal.
- ✅ Ningún cambio de código adicional: ya está capado desde R1.4.
- ⚠️ Si en el futuro aparece demanda real de "cuadrillas" (eventos con 10+
  puestos idénticos publicados como una sola unidad), es una decisión de
  producto nueva que requeriría su propio ADR — no reabre este.
