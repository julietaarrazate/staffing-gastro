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

## 1. Hallazgo principal: el `LICENSE` es la plantilla de Apache 2.0 sin completar

`LICENSE:189` — la última línea del archivo, donde la plantilla oficial de
Apache 2.0 pide reemplazar con los datos reales, **sigue literalmente
así**:

```
   Copyright [yyyy] [name of copyright owner]
```

Es decir: el repo **no tiene ningún aviso de copyright válido hoy** — lo
que hay es el texto de ejemplo de la plantilla, nunca completado con un
año y un titular reales. Esto es anterior y más básico que la pregunta de
"¿qué licencia conviene" (§2): sea cual sea la licencia elegida, **falta
completar quién es el titular del copyright y desde cuándo**, dato
imprescindible para cualquier registro DNDA (que exige identificar
autor/titular y fecha de creación/publicación).

- **Severidad para DNDA:** alta — es un prerrequisito literal, no una
  mejora. **Acción:** completar `[yyyy] [name of copyright owner]` con el
  año y el titular real (persona física o la razón social bajo la que se
  vaya a registrar) — **decisión de Julieta/asesoría legal**, no
  técnica.

## 2. Apache 2.0 — permisiva y de código abierto, ¿es la licencia querida?

Apache 2.0 es una licencia **permisiva de código abierto**: permite a
cualquiera usar, modificar y redistribuir el código, incluso
comercialmente, con la sola condición de mantener el aviso de copyright y
la licencia. Es la licencia típica de una **librería o herramienta que se
quiere que otros adopten libremente** — no la típica de un **producto
propietario** que se piensa registrar ante DNDA para proteger
exclusividad comercial (un marketplace con modelo de negocio de
suscripción, como es Oído según `docs/PRODUCT.md`/ADR-0005).

- **No es un hallazgo de código, es una pregunta de negocio sin resolver
  en el repo:** si la intención es que el código sea privativo (lo más
  común para este tipo de producto), Apache 2.0 **contradice esa
  intención** — cualquiera podría clonar el repo (si el repo es o llega a
  ser público) y operar una copia legal del producto. Si en cambio la
  intención es abrir parte del código, Apache 2.0 es una elección
  razonable, pero entonces conviene que el registro DNDA lo refleje
  explícitamente (qué se registra como propietario vs. qué queda bajo la
  licencia abierta).
- **No se decide ni se cambia acá** — requiere una decisión explícita de
  negocio/legal antes de cualquier registro. Se deja como bloqueante
  documentado en `13_ROADMAP.md`.

## 3. Autoría en el historial de git — dato objetivo, sin interpretación legal

`git log --format='%an' | sort | uniq -c`:

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
| 1 | Completar `Copyright [yyyy] [name]` en `LICENSE` con datos reales | 🔴 Pendiente | Julieta + asesoría legal |
| 2 | Decidir si Apache 2.0 es la licencia querida (o reemplazar por una propietaria) | 🔴 Pendiente, bloqueante | Julieta + asesoría legal |
| 3 | Definir cómo se declara la autoría/titularidad de los tramos con asistencia de IA | 🔴 Pendiente | Asesoría legal (dato ya reunido en §3) |
| 4 | Agregar `NOTICE`/archivo de titularidad, una vez resueltos 1-3 | ⬜ Depende de 1-3 | Julieta |
| 5 | Índice del proyecto para acompañar el depósito | ✅ Ya existe (`01_INVENTORY.md`) | — |
| 6 | Estructura/nombres presentables | ✅ Ya verificado (`10_REPOSITORY.md`) | — |
| 7 | Comentarios de código sin contenido problemático | ✅ Verificado, sin hallazgos | — |

## 8. Veredicto de esta fase

El código en sí (estructura, nombres, comentarios) **está listo para
presentarse** sin cambios. Lo que falta es enteramente de **naturaleza
legal/administrativa, no técnica**: completar un aviso de copyright que
hoy es literalmente una plantilla sin rellenar, decidir conscientemente
si Apache 2.0 es la licencia correcta para un producto que se piensa
registrar como propietario, y resolver — con asesoría legal, no con este
documento — cómo se declara la autoría de los tramos desarrollados con
asistencia de IA. Ninguno de los tres puede ni debe resolverse
automáticamente en un PR de código.
