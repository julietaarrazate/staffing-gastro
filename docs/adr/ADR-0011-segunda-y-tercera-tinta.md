# ADR-0011 — Segunda y tercera tinta: Espresso (estructura) y Petróleo (confianza)

**Estado:** aceptado · **Fecha:** 2026-08-14

## Contexto

`ART_DIRECTION.md §12` fija el naranja como único acento, deliberadamente al
~5% de la superficie ("si ocupa más, deja de significar 'acá se toca'") —
una decisión estratégica para diferenciarse de Rappi/Glovo por disciplina, no
por paleta. Julieta reportó que el resultado se percibe "plano/apagado":
lectura válida y directa de quien usa el producto todos los días, no un error
de ejecución — es la consecuencia esperada de un sistema con sólo neutros +
un acento al 5%, sin el escalón intermedio que un 60-30-10 real tendría.

Se evaluaron 3 candidatos a color secundario (espresso, terracota, petróleo)
mostrados sobre componentes reales del producto (no swatches aislados), con
el naranja de acción constante en los tres para verificar que ninguno lo
reemplaza como único acento interactivo. Julieta eligió espresso y petróleo,
preguntando si ambos podían convivir.

Separado por completo: revisando `TRUST_SYSTEM.md`/`ADR-0010`, ya existe un
mandato sin cumplir — `ADR-0010 §5`: *"'Identidad verificada' se renderiza
como un atributo de Identidad, con tratamiento visual propio, separado de las
insignias de desempeño."* La implementación actual (`IdentityVerifiedBadge.tsx`)
nunca le dio ese tratamiento propio: usa `tone="secondary"`, el mismo verde
que cualquier estado de éxito genérico — exactamente la mezcla de conceptos
que el ADR-0010 quería evitar (identidad ≠ resultado de una acción).

## Decisión

Dos colores nuevos, con **roles que no se solapan** — la regla de
`DESIGN_TOKENS.md §4`/`ART_DIRECTION.md §12.3.4` ("sin colores nuevos sin
ADR — cada color agregado divide el significado del sistema") se cumple
dándole a cada uno un trabajo que ningún otro token ya cubre:

| Token | Valor | Rol | Reemplaza a |
|---|---|---|---|
| `--color-structure` | `#4a3428` (Espresso) | Estructura y momentos de marca — fondos de sección, heroes de onboarding. La "segunda tinta" literal (moodboard "El sistema", `ART_DIRECTION.md §7`: *"un manual técnico impreso en dos tintas"*). | Nada — rol nuevo, hoy esos fondos usan `--color-ink` genérico o directamente no existen como patrón. |
| `--color-trust` / `--color-trust-text` | `#1e4a47` (Petróleo) | **Identidad/confianza verificada, exclusivamente.** No es decorativo: cumple el mandato ya escrito en `ADR-0010 §5`. | El uso de `tone="secondary"` (verde éxito) en `IdentityVerifiedBadge` — bug de implementación contra un ADR ya aceptado, no un cambio de diseño nuevo. |

El naranja **no cambia de rol**: sigue siendo el único acento interactivo por
pantalla (`ART_DIRECTION.md §12.3.1`, innegociable). Verde y rojo de estado
tampoco cambian (`§12.3.3`, sólo estado). Petróleo es un tercer eje de
significado — identidad, no estado ni acción — así como `ADR-0010` ya separa
identidad de reputación como dominios ortogonales.

### Alcance de ESTE ADR

Implementación inmediata (bajo riesgo, corrige un gap contra un ADR ya
aceptado): tokens de color + `IdentityVerifiedBadge` migrado de
`tone="secondary"` a `tone="trust"`.

Fuera de esta implementación, staged para revisión visual posterior (mismo
criterio que cualquier cambio que toque muchas pantallas a la vez sin poder
verificarlas todas): rollout de `--color-structure` en fondos de sección y
heroes de onboarding; señal de "comercio verificado" en el feed del
trabajador (`ShiftCard`) — bloqueado además por falta de dato: `Shift`/
`ShiftPublic` no exponen hoy verificación de identidad del comercio
(`negocio_verificado`, ya previsto en `ADR-0010 §6` como dominio bidireccional,
pero no implementado en el backend todavía).

## Consecuencias

- ✅ Cierra un gap real contra `ADR-0010` (identidad ya no comparte color con
  reputación/éxito genérico) sin escribir ningún dominio nuevo.
- ✅ Responde al feedback de producto ("plano/apagado") con una decisión
  acotada — dos colores con trabajos que no se pisan, no una repaleta.
- ✅ El naranja sigue siendo el 5% — la estrategia de diferenciación vs.
  Rappi/Glovo (`§12.1`) no se toca.
- ⚠️ `--color-structure` queda definido y documentado pero **sin rollout
  amplio todavía** — aplicarlo a onboarding/heroes es tarea aparte, con
  verificación visual pantalla por pantalla antes de mergear.
- ➡️ "Comercio verificado" en el feed del trabajador queda bloqueado hasta
  que exista el campo de verificación de negocio en el backend (dominio
  Identity, `ADR-0010 §6`) — no se simula con datos falsos.
