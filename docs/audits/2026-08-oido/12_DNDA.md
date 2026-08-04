# 12 — DNDA (registro de propiedad intelectual)

> Fase 12 de la auditoría OÍDO. Mandato: preparar el proyecto para una
> futura presentación del código fuente ante la Dirección Nacional del
> Derecho de Autor (Argentina). Verificar: estructura, nombres, licencia,
> copyright, comentarios, índice del proyecto.
>
> **Límite explícito de esta fase:** esta auditoría es técnica, no legal.
> Lo que sigue son **hechos verificables en el repositorio** (qué dice el
> `LICENSE`, quién aparece como autor en el historial de git, qué falta) —
> no una opinión sobre cómo debe interpretarse el trabajo asistido por IA
> bajo la Ley 11.723 argentina, ni sobre qué titularidad reclamar. Eso
> requiere asesoría legal específica; se marca cada vez que corresponde.
> Sin cambios de código.

## 1. Hallazgo principal: el `LICENSE` era la plantilla de Apache 2.0 sin completar

> ✅ **Resuelto (2026-08-04).** A pedido explícito de Julieta, `LICENSE` se
> reemplazó por una licencia propietaria de código cerrado ("All Rights
> Reserved"), con **Julieta Arrazate** como única titular del copyright
> (2026). Se deja el análisis original abajo como registro de por qué era
> un hallazgo.

`LICENSE:189` (versión anterior) — la última línea del archivo, donde la
plantilla oficial de Apache 2.0 pide reemplazar con los datos reales,
**seguía literalmente así**:

```
   Copyright [yyyy] [name of copyright owner]
```

Es decir: el repo **no tenía ningún aviso de copyright válido** — lo que
había era el texto de ejemplo de la plantilla, nunca completado con un año
y un titular reales. Esto era anterior y más básico que la pregunta de
"¿qué licencia conviene" (§2): sea cual sea la licencia elegida, **hacía
falta completar quién es el titular del copyright y desde cuándo**, dato
imprescindible para cualquier registro DNDA (que exige identificar
autor/titular y fecha de creación/publicación).

## 2. Apache 2.0 — permisiva y de código abierto, ¿era la licencia querida?

> ✅ **Resuelto (2026-08-04).** Julieta confirmó que la intención es código
> cerrado/propietario — el análisis de abajo (por qué Apache 2.0 la
> contradecía) queda como registro de la decisión, no como pendiente.

Apache 2.0 era una licencia **permisiva de código abierto**: permitía a
cualquiera usar, modificar y redistribuir el código, incluso
comercialmente, con la sola condición de mantener el aviso de copyright y
la licencia. Es la licencia típica de una **librería o herramienta que se
quiere que otros adopten libremente** — no la de un **producto
propietario** que se piensa registrar ante DNDA para proteger
exclusividad comercial (un marketplace con modelo de negocio de
suscripción, como es Oído según `docs/foundation/PRODUCT.md`/ADR-0005). Con Apache
2.0, cualquiera podría haber clonado el repo (si llegaba a ser público) y
operado una copia legal del producto — la nueva licencia ("All Rights
Reserved", sin permiso de copia/modificación/distribución/uso sin
autorización escrita) cierra esa brecha.

## 3. Autoría y titularidad — criterio fijado por Julieta (2026-08-04)

> ✅ **Resuelto.** Julieta estableció el criterio explícitamente: la autoría
> y titularidad del software corresponden **exclusivamente** a Julieta
> Arrazate — fundadora y desarrolladora responsable. Las herramientas de
> desarrollo con IA se usaron únicamente como **herramientas de
> asistencia** durante el proceso (igual que un editor de código, un
> framework o cualquier otra herramienta de productividad), bajo
> dirección, criterio, decisiones técnicas, validación, integración y
> control humano en todo momento. **No hay coautoría, cofundador, cesión
> de derechos ni participación de terceros** en la propiedad intelectual
> del producto. Este criterio queda formalizado en el archivo
> [`NOTICE`](../NOTICE) de la raíz del repo — es el documento que hay que
> citar de ahora en más, no este análisis. **No se modificó el historial
> de git por este motivo** (instrucción explícita de Julieta) — los datos
> del historial de abajo quedan como registro de lo que se relevó, no como
> algo a "corregir".

`git log --format='%an' | sort | uniq -c` (dato objetivo relevado en esta
auditoría, ver interpretación arriba):

| Autor (campo `git author`) | Commits |
|---|---:|
| `julietaarrazate` | 97 |
| `Claude` (`noreply@anthropic.com`) | 21 |

De los 97 commits con `julietaarrazate` como autor principal, la gran
mayoría incluye un trailer `Co-authored-by: Claude <noreply@anthropic.com>`
+ `Claude-Session: <link>` (verificado por muestreo) — es decir, el
historial **ya documenta de forma transparente y consistente** cuándo hubo
asistencia de IA en un commit dirigido por Julieta. Los 21 commits con
`Claude` como autor principal corresponden a sesiones donde el agente
corrió de forma más autónoma (como la que generó este mismo documento) sin
que el campo de autor git quedara asignado a una persona.

- **Esto no es un hallazgo de "algo mal hecho"** — es información que
  cualquier abogado de propiedad intelectual va a necesitar ver tal cual
  está, para asesorar sobre cómo caracterizar la autoría/titularidad ante
  DNDA (la ley argentina de propiedad intelectual, y la práctica de DNDA
  específicamente para obras con asistencia de IA, es un área activa y no
  trivial — **fuera del alcance de lo que este documento puede resolver**).
  Se dimensiona el dato para que la conversación con el asesor legal
  arranque con evidencia concreta, no con una estimación.

## 4. No existe archivo `NOTICE`/`AUTHORS`/`CONTRIBUTORS`

Ninguno de los tres existe en la raíz del repo. No es infrecuente en un
proyecto de este tamaño/etapa, pero para una presentación DNDA es un lugar
natural y barato de declarar, en un solo archivo, el titular del copyright,
la fecha de primera creación/publicación, y — si así se decide — una nota
sobre el uso de asistencia de IA en el desarrollo. **Acción propuesta**
(no ejecutada, requiere la decisión de §1/§2 primero): agregar un `NOTICE`
una vez resueltas las preguntas de titularidad y licencia.

## 5. Comentarios en el código — sin hallazgos, coherente con el estilo del repo

No se encontró lenguaje inapropiado, información sensible, ni comentarios
que comprometan la presentación del código (credenciales, datos
personales reales, chistes internos). El estilo de comentarios del repo
(explicar el "por qué", no el "qué"; sin bloques de documentación
extensos) es limpio y presentable tal cual está — no requiere una pasada
de limpieza de comentarios antes de un registro.

## 6. Estructura y nombres — ya cubierto, remite a fases anteriores

- **Índice del proyecto:** ya generado en `01_INVENTORY.md` (mapa completo
  de frontend/backend/infra/DB/CI/docs/scripts/config). Es reutilizable
  tal cual como el índice que DNDA suele pedir junto con el código fuente
  depositado.
- **Nombres poco profesionales / estructura de carpetas:** ya evaluado en
  `10_REPOSITORY.md` — veredicto: el repo ya se ve profesional, sin
  residuos ni nombres descuidados. Nada adicional que verificar desde el
  ángulo DNDA específicamente.

## 7. Checklist de lo que falta antes de un registro DNDA (no legal, sólo repo)

| # | Ítem | Estado | Quién resuelve |
|---|---|---|---|
| 1 | Completar `Copyright [yyyy] [name]` en `LICENSE` con datos reales | ✅ Resuelto (Julieta Arrazate, 2026) | — |
| 2 | Decidir si Apache 2.0 es la licencia querida (o reemplazar por una propietaria) | ✅ Resuelto — licencia propietaria "All Rights Reserved" | — |
| 3 | Definir cómo se declara la autoría/titularidad de los tramos con asistencia de IA | ✅ Resuelto — criterio de Julieta, formalizado en `NOTICE` | — |
| 4 | Agregar `NOTICE`/archivo de titularidad | ✅ Resuelto — `NOTICE` en la raíz del repo | — |
| 5 | Índice del proyecto para acompañar el depósito | ✅ Ya existe (`01_INVENTORY.md`) | — |
| 6 | Estructura/nombres presentables | ✅ Ya verificado (`10_REPOSITORY.md`) | — |
| 7 | Comentarios de código sin contenido problemático | ✅ Verificado, sin hallazgos | — |

## 8. Veredicto de esta fase

El código en sí (estructura, nombres, comentarios) **está listo para
presentarse** sin cambios. Los tres pendientes de naturaleza
legal/administrativa que identificó esta fase **ya se resolvieron**, todos
por decisión explícita de Julieta: el aviso de copyright (`LICENSE`), la
elección de licencia (propietaria, "All Rights Reserved", en vez de
Apache 2.0), y el criterio de autoría/titularidad para el trabajo asistido
por IA (formalizado en `NOTICE`: Julieta Arrazate como única titular y
autora responsable; la IA como herramienta de asistencia, sin derechos
sobre la obra). El repositorio queda, con esto, sin pendientes abiertos
para una futura presentación ante DNDA que dependan de este documento —
cualquier verificación final de forma (redacción exacta de `NOTICE`/
`LICENSE`, requisitos puntuales del trámite DNDA) sigue siendo trabajo de
asesoría legal, no de este análisis.
