# DESIGN_TOKENS.md — Tokens de diseño de Staffya

> Fase 3.3 del roadmap de [ART_DIRECTION.md](./ART_DIRECTION.md).
> El contrato entre diseño y código: **todo valor visual que se repite tiene
> nombre**.
>
> Complementa a [COLOR_SYSTEM.md](./COLOR_SYSTEM.md) (el porqué de cada color),
> [TYPOGRAPHY_SYSTEM.md](./TYPOGRAPHY_SYSTEM.md) y
> [ICONOGRAPHY_SYSTEM.md](./ICONOGRAPHY_SYSTEM.md).
>
> Preparado: 2026-07-29 · Versión 1.0

---

## 1. Qué es un token y por qué importa acá

Un token es **un valor con nombre**. `--color-primary` en vez de `#ff6b00`.

No es burocracia: es lo que hace que cambiar la marca sea **un archivo** en
vez de una búsqueda a mano por 200 lugares. Este proyecto ya pagó el precio de
no tenerlos —**289 colores crudos** repartidos en 30 archivos, y el gradiente
de marca duplicado como hex en 7— y ya cobró el beneficio de arreglarlo.

**La regla, y no tiene excepciones:**

> Si un valor visual aparece **más de una vez**, es un token.
> Si aparece **una sola vez**, probablemente esté mal.

---

## 2. Auditoría del estado actual

Medido sobre `app/` + `components/`:

| Token | Usos | Veredicto |
|---|---|---|
| `--color-primary-text` | 63 | ✅ Sano |
| `--color-danger-text` | 28 | ✅ Sano |
| `--color-secondary` | 13 | ⚠️ **Duplica a `--color-success`** (mismo hex) |
| `--color-success-text` | 5 | ✅ Sano |
| `--color-paper` | 4 | ⚠️ Sólo en la landing |
| `--color-warning` | **0** | ❌ **Muerto** |

### 2.1 Tres problemas detectados

**1. `--color-warning` no se usa nunca.** Existe `#fbbf24` declarado y ningún
componente lo consume. Un token muerto es peor que ninguno: alguien lo va a
usar algún día creyendo que forma parte del sistema.

**2. `--color-secondary` y `--color-success` son el mismo color** (`#22c55e`)
con dos nombres. Eso rompe la premisa del sistema: **un valor, un nombre, un
significado**. Hoy nadie sabe cuál usar, y por eso se usan los dos.

**3. No hay tokens de espaciado, motion ni z-index.** Los valores están
sueltos en las clases. La consecuencia es visible: **siete niveles distintos
de `z-index`** (10, 20, 30, 40, 50, 60, 100) sin un orden declarado, y
duraciones de animación hardcodeadas en cuatro valores distintos.

---

## 3. Los tokens

### 3.1 Color — superficie

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#ff6b00` | Acento de marca: fondo de botón, chips activos |
| `--color-primary-strong` | `#e85f00` | Estado presionado, par de marca |
| `--color-ink` | `#111111` | Texto principal; fondo en momentos de marca |
| `--color-background` | `#f8f9fa` | Fondo de app |
| `--color-surface` | `#f1f3f5` | Chips, campos inactivos, tracks |
| `--color-line` | `#ececee` | Bordes de 1 px |
| `--color-paper` | `#fbf8f4` | Fondo cálido de la landing |
| `--color-success` | `#22c55e` | Superficie de éxito |
| `--color-danger` | `#ef4444` | Superficie de error |

### 3.2 Color — texto (contraste AA verificado)

| Token | Valor | Contraste sobre blanco |
|---|---|---|
| `--color-primary-text` | `#c65300` | **4.53** ✅ |
| `--color-success-text` | `#17853f` | **4.71** ✅ |
| `--color-danger-text` | `#d73d3d` | **4.54** ✅ |

> **Regla crítica:** sobre fondo **ink** se usa el token de *superficie*
> (brillante), no el de texto. Sobre `#111111` el naranja brillante da **6.61**
> y el de texto **4.17** — invertido, falla. Ver `COLOR_SYSTEM.md` §4.

### 3.3 Geometría

| Token | Valor | Uso |
|---|---|---|
| `--radius-card` | `1.5rem` (24) | Tarjetas |
| `--radius-btn` | `1.25rem` (20) | Botones |
| `--radius-input` | `1.125rem` (18) | Campos |
| `--radius-sheet` | `1.75rem` (28) | Hojas inferiores |

### 3.4 Elevación

| Token | Valor | Uso |
|---|---|---|
| `--shadow-soft` | `0 8px 24px rgba(17,17,17,.06)` | Reposo |
| `--shadow-float` | `0 16px 40px rgba(17,17,17,.12)` | Por encima (deck, hojas) |

**Dos sombras, no más.** Prohibidas las difusas grandes: envejecen a 2016.

### 3.5 Tipografía

| Token | Valor |
|---|---|
| `--font-display` | Archivo *(pendiente de integrar)* |
| `--font-sans` | Geist |
| `--font-mono` | Geist Mono |

Escala modular 1.25: `12 · 14 · 16 · 20 · 25 · 31 · 39 · 49`.

### 3.6 Iconos

| Token | Valor |
|---|---|
| `--icon-xs` | 16 |
| `--icon-sm` | 20 |
| `--icon-md` | 24 |
| `--icon-lg` | 32 |

### 3.7 Motion — **a crear**

`ART_DIRECTION` §13.3 especifica estos valores, pero **hoy están hardcodeados
en cada componente**:

| Token propuesto | Valor | Uso |
|---|---|---|
| `--motion-ui` | `200ms` | Transiciones de interfaz |
| `--motion-brand` | `500ms` | Gesto de marca |
| `--motion-ease` | `cubic-bezier(0.2, 0, 0, 1)` | Entrada rápida, salida firme |
| `--motion-press` | `scale(0.96)` | Feedback táctil |

**Sin rebote.** El rebote comunica juego; la llegada seca comunica precisión
(§13.2).

### 3.8 Z-index — **a crear**

Hoy hay siete niveles sin orden declarado. Propuesta:

| Token | Valor | Qué vive ahí |
|---|---|---|
| `--z-base` | 0 | Contenido |
| `--z-raised` | 10 | Tarjetas superpuestas, deck |
| `--z-nav` | 40 | Barra inferior, header |
| `--z-overlay` | 50 | Hojas, modales |
| `--z-toast` | 60 | Avisos temporales |

**Cinco niveles alcanzan.** Si hace falta un sexto, casi siempre el problema
es de estructura, no de apilado.

---

## 4. Reglas

1. **Ningún valor visual repetido sin token.** Un color, radio, sombra o
   duración que aparece dos veces se nombra.
2. **Un valor, un nombre.** Dos tokens con el mismo valor son un bug
   (`secondary`/`success` hoy).
3. **Ningún token sin uso.** Se borra (`warning` hoy).
4. **Superficie ≠ texto.** Un color de superficie nunca se usa como texto
   sobre claro sin su variante `-text`.
5. **Los tokens nuevos se documentan acá**, no sólo en el CSS.
6. **Nada de valores mágicos en componentes.** Si aparece un `#hex` o un
   `Npx` suelto en un `.tsx`, es deuda.

---

## 5. Plan de limpieza

| # | Acción | Riesgo |
|---|---|---|
| 1 | Eliminar `--color-warning` (0 usos) | Ninguno |
| 2 | Unificar `--color-secondary` → `--color-success` (13 usos) | Bajo, mecánico |
| 3 | Crear tokens de motion y migrar las duraciones sueltas | Bajo |
| 4 | Crear tokens de z-index y mapear los 7 niveles a 5 | **Medio** — el apilado hay que verificarlo mirando |
| 5 | Integrar `--font-display` con Archivo | Pendiente de la decisión tipográfica |

**El paso 4 no es mecánico:** cambiar z-index sin mirar la pantalla puede
tapar cosas. Se hace con capturas de cada pantalla que use superposición.

---

## 6. Checklist

- [ ] No hay tokens con 0 usos
- [ ] No hay dos tokens con el mismo valor
- [ ] No hay `#hex` sueltos en componentes
- [ ] Todo color de texto sobre claro usa su variante `-text`
- [ ] Las duraciones salen de tokens, no de números sueltos
- [ ] El z-index tiene como máximo 5 niveles
- [ ] Este documento coincide con `globals.css`

---

## 7. Dónde vive cada cosa

| Qué | Archivo |
|---|---|
| Definición de tokens | `frontend/app/globals.css` |
| Radios y sombras | `:root` |
| Colores de marca | bloque `@theme` (genera utilidades Tailwind) |
| Tipografías | `@theme inline` + `next/font` en `layout.tsx` |
| Este contrato | `docs/DESIGN_TOKENS.md` |

> Si el CSS y este documento se contradicen, **gana el CSS** y hay que
> actualizar el documento en el mismo PR. La documentación que miente es peor
> que la que falta.
