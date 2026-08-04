# ICONOGRAPHY_SYSTEM.md — Sistema de iconografía de Staffya

> Fase 3.4 del roadmap de [ART_DIRECTION.md](./ART_DIRECTION.md).
> Define qué íconos usa Staffya, en qué tamaños, con qué peso y bajo qué
> reglas.
>
> Preparado: 2026-07-29 · Versión 1.0

---

## 1. Diagnóstico: hay íconos, no hay sistema

Auditoría sobre `app/` + `components/`:

| Dato | Valor |
|---|---|
| Íconos exportados | **42** |
| Base | Lucide, envueltos en `components/icons.tsx` |
| Grosor de trazo | `1.75` uniforme |
| **Tamaños distintos en uso** | **12** |

Los doce tamaños: `11, 12, 13, 14, 15, 16, 18, 20, 22, 26, 28, 48`.

**Eso no es una escala. Es azar.** Cada pantalla eligió el número que quedaba
bien en ese momento. Un ícono de 13 px al lado de uno de 14 px no se lee como
decisión: se lee como descuido, y es exactamente el tipo de inconsistencia que
hace que un producto se sienta "hecho por partes".

**Lo que sí está bien y se conserva:**

1. **Una sola fuente** (Lucide). No hay mezcla de librerías, que es el error
   más común y el más difícil de revertir.
2. **Un wrapper propio** (`make()` en `icons.tsx`), que centraliza el grosor y
   permite cambiar todo desde un lugar.
3. **Grosor uniforme** en 1.75.

El problema es el tamaño, no la fuente.

---

## 2. La escala

> **Cuatro tamaños. Ninguno más.**

| Token | px | Uso | Ejemplo |
|---|---|---|---|
| `xs` | **16** | Inline con texto, metadatos | Pin de ubicación junto a la ciudad |
| `sm` | **20** | Acompañando acciones y listas | Ícono dentro de un botón |
| `md` | **24** | Navegación, encabezados | Barra inferior |
| `lg` | **32** | Estados vacíos, hitos | Ícono de "no hay turnos" |

**Todos múltiplos de 4**, alineados a la grilla base. Los tamaños intermedios
(13, 15, 18, 22, 26) desaparecen: no aportaban información, sólo ruido.

**Excepción única:** ilustraciones y estados vacíos grandes pueden usar 48 px,
pero eso ya no es un ícono — es una pieza ilustrada y se rige por
`ILLUSTRATION_SYSTEM.md`.

### 2.1 Por qué cuatro y no más

Cada tamaño adicional obliga a una decisión en cada uso. Con cuatro, la
elección es automática: *¿está en línea con texto? 16. ¿En un botón? 20. ¿En
navegación? 24. ¿Es el protagonista de una pantalla vacía? 32.*

Un sistema que hay que pensar en cada uso no es un sistema.

---

## 3. Grosor de trazo

**`1.75` para todos los tamaños.** Se mantiene.

### 3.1 Por qué no escalar el grosor

La tentación es hacer el trazo más fino en íconos chicos y más grueso en
grandes. **No se hace**, por dos motivos:

1. **Coherencia con el sistema visual.** `ART_DIRECTION` §6.1 define
   "precisión cálida": geometría exacta en la estructura. Un grosor constante
   es exactamente eso.
2. **Es la convención de Lucide.** Pelearse con la fuente produce íconos que
   se ven levemente mal sin que se pueda decir por qué.

### 3.2 Cuándo sí se rellena

El wrapper ya soporta `filled`. La regla:

| Estado | Tratamiento |
|---|---|
| **Inactivo / por defecto** | Trazo |
| **Activo / seleccionado** | Trazo + color de acento |
| **Valor cuantificado** | **Relleno** — sólo estrellas de rating |

**El relleno no se usa como decoración.** Una estrella llena significa "este
punto está contado". Un ícono relleno sin ese significado confunde.

---

## 4. Color

Los íconos **no tienen color propio**. Heredan el del texto que acompañan
(`currentColor`), con estas asignaciones:

| Contexto | Color | Motivo |
|---|---|---|
| Junto a texto principal | `text-ink` | Es parte del texto |
| Metadatos, secundario | `text-ink/40` | Debe pesar menos que el dato |
| Acción principal | `text-primary-text` sobre claro | Contraste AA (ver `COLOR_SYSTEM.md`) |
| Sobre fondo ink | `text-primary` (brillante) | Sobre `#111111` el oscuro falla: 4.17 vs 6.61 |
| Navegación activa | Acento | Marca dónde estás |
| Navegación inactiva | `text-ink/40` | No compite |

**Regla:** un ícono nunca lleva un color que su texto no lleve. Si el texto es
gris y el ícono naranja, el ícono está gritando algo que el texto no dice.

---

## 5. Semántica: un ícono, un significado

El error más caro de una iconografía no es estético — es **usar el mismo ícono
para dos cosas** o **dos íconos para la misma cosa**.

### 5.1 Mapa vigente

| Concepto | Ícono | Regla |
|---|---|---|
| Ubicación, distancia | `MapPin` | **Nunca** para "mapa" (eso es `Map`) |
| Fecha y horario | `Calendar` | — |
| Duración, "hace X" | `Clock` | **Nunca** para fecha |
| Dinero, pago | `Wallet` | — |
| Personas requeridas | `Users` | **Nunca** para "perfil" (eso es `User`) |
| Conversación | `MessageCircle` | — |
| Reputación | `Star` (rellena) | Único ícono relleno del sistema |
| Turno / publicación | `ClipboardList` | — |
| Urgencia | `Zap` | **Sólo** cuando el turno es urgente de verdad |
| Éxito, confirmado | `CircleCheck` | — |
| Error, cancelado | `CircleX` | — |
| Advertencia | `TriangleAlert` | No-show, cancelación tardía |

### 5.2 Reglas de extensión

Antes de agregar un ícono nuevo:

1. **¿Ya hay uno para ese concepto?** Reusarlo. 42 íconos ya es mucho.
2. **¿El concepto merece un ícono?** Muchas cosas se explican mejor con
   palabras. Un ícono ambiguo es peor que ninguno.
3. **¿Está en Lucide?** Si no, se busca el más cercano. **No se mezclan
   librerías nunca.**
4. **¿Se lee a 16 px?** Los íconos con mucho detalle desaparecen. Se prueba.

---

## 6. Accesibilidad

### 6.1 Íconos decorativos vs. informativos

| Tipo | Tratamiento |
|---|---|
| **Decorativo** (acompaña texto que ya lo dice) | `aria-hidden="true"` |
| **Informativo** (es la única señal) | `aria-label` descriptivo |
| **Botón sólo con ícono** | `aria-label` **obligatorio** |

Un ícono junto a la palabra "Palermo" es decorativo: el lector de pantalla no
debe leer "pin de ubicación Palermo". Un botón que es sólo una campana
necesita decir "Notificaciones".

### 6.2 Área de toque

**El tamaño visual del ícono no es el área tocable.** Un ícono de 20 px dentro
de un botón necesita **mínimo 48×48 px** de área de toque.

Esto ya se cumple en el producto (`min-h-[48px]` en `Button`), pero los
botones que son sólo un ícono tienen que declararlo explícitamente.

---

## 7. Plan de migración

| Paso | Qué | Riesgo |
|---|---|---|
| 1 | Mapear los 12 tamaños actuales a los 4 de la escala | Bajo |
| 2 | Reemplazar mecánicamente | Bajo, verificable con captura |
| 3 | Revisar los usos de 48 px: ¿ícono o ilustración? | Requiere criterio |
| 4 | Auditar `aria-hidden` / `aria-label` | Bajo |

### 7.1 Tabla de conversión

| Actual | Pasa a | Motivo |
|---|---|---|
| 11, 12, 13, 14, 15, 16 | **16** | Todos son "inline con texto" |
| 18, 20, 22 | **20** | Todos son "en acción" |
| 24, 26, 28 | **24** | Todos son "navegación / encabezado" |
| 30, 32 | **32** | Estado vacío |
| 36+ | Evaluar | Probablemente sea ilustración, no ícono |

---

## 8. Antipatrones

| Antipatrón | Por qué |
|---|---|
| Mezclar librerías | Estilos incompatibles. El más difícil de revertir. |
| Íconos de colores planos | Rompe `currentColor` y la coherencia |
| Emoji como ícono | Prohibido por `ART_DIRECTION` §6.3 |
| Ícono sin texto en acciones importantes | La ambigüedad cuesta más que el espacio ahorrado |
| Dos íconos para el mismo concepto | Destruye el aprendizaje del usuario |
| Íconos con detalle a 16 px | Se convierten en manchas |
| Rellenar por estética | El relleno significa "cuantificado" |

---

## 9. Checklist

- [ ] Todos los íconos usan uno de los 4 tamaños
- [ ] Ninguno tiene color que su texto no tenga
- [ ] Los decorativos llevan `aria-hidden`
- [ ] Los botones de sólo ícono llevan `aria-label`
- [ ] Área de toque ≥ 48 px en todo botón con ícono
- [ ] Ningún concepto tiene dos íconos distintos
- [ ] Verificado a 16 px en pantalla real

---

## 10. Nota sobre íconos propios

Este sistema usa **Lucide**, no íconos dibujados a medida. Es deliberado para
esta etapa:

- 42 íconos propios es un proyecto de semanas para un diseñador.
- La iconografía **no** es donde se juega la diferenciación de marca. El
  logotipo y la ilustración sí.
- Lucide es coherente, mantenida y legible.

**Cuándo revisarlo:** si el diseñador entrega un logotipo con un lenguaje de
trazo muy propio, puede valer la pena dibujar **los 5 o 6 íconos más visibles**
(navegación) en ese lenguaje y dejar el resto en Lucide. Ese híbrido es común
y rinde bien.
