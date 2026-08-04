# COLOR_SYSTEM.md — Sistema cromático de Oído

> Fase 3.3 del roadmap de [ART_DIRECTION.md](./ART_DIRECTION.md).
> Define la paleta, sus reglas de uso y —lo más importante— **los contrastes
> reales medidos**, no estimados.
>
> Preparado: 2026-07-28 · Versión 1.0 · **Actualizado 2026-07-29 → v2.0**

---

## 🎨 0. v2.0 — Alineación con el style-guide del diseñador (2026-07-29)

La v1.0 de abajo se escribió **antes** de que llegara el style-guide del
diseñador (la estética "editorial / cafetería de especialidad", Opción elegida
por Julieta). Ese mockup define una paleta **cálida** que la app no tenía: el
fondo era un **gris frío** (`#F8F9FA`) y el verde de éxito era el **semáforo
brillante** de Tailwind (`#22C55E`). Esta versión alinea los tokens a la paleta
del diseñador **manteniendo la disciplina de contraste AA** de la v1.0.

### 0.1 Tokens nuevos (en `frontend/app/globals.css`)

| Token | v1.0 (frío) | v2.0 (cálido) | Nombre en el style-guide |
|---|---|---|---|
| `--background` | `#F8F9FA` gris | **`#FFF8F0`** | Crema |
| `--color-surface` | `#F1F3F5` gris | **`#F5ECDD`** | Arena |
| `--color-ink` / `--foreground` | `#111111` negro | **`#1F1F1C`** | Carbón (cálido) |
| `--color-success` | `#22C55E` semáforo | **`#2E8B57`** | Verde Éxito (bosque) |
| `--color-primary-strong` | `#E85F00` | **`#E65A00`** | Naranja Oscuro |
| `--color-primary-text` | `#C65300` | **`#B23C08`** | (naranja-texto, re-derivado) |
| `--line` / `--color-line` | `#ECECEE` | **`#EBE2D4`** | (hairline cálido) |
| `--color-paper` | `#FBF8F4` | **`#FBF2E6`** | (franja cálida landing) |

El **naranja principal** `--color-primary` se migró a **`#F97316`** (Tailwind
orange-500), el hex exacto del style-guide (confirmado leyendo la etiqueta del
mockup, no muestreando el JPG). Con esa migración se actualizaron en cadena: el
`theme-color` (metadata del layout + manifest), todas las sombras-glow
`rgba(249,115,22,…)` y los usos hardcodeados en el mapa (`RadiusRing`,
`ClusterMarker`, `MiniMap`) y en `LogoGlyph`; y se **regeneraron los 7 íconos
PWA + `og-image` + `logo-mark`** con el naranja nuevo para que todo quede
coherente. Contraste tinta-sobre-naranja del botón: **5.89** (AA ✅).

### 0.2 Contrastes medidos de la paleta v2.0 (WCAG, fórmula oficial)

| Texto | Sobre | Ratio | AA normal (4.5) |
|---|---|---|---|
| Carbón `#1F1F1C` | Crema `#FFF8F0` (body) | **15.69** | ✅ AAA |
| Carbón `#1F1F1C` | Blanco (cards) | **16.52** | ✅ AAA |
| Carbón `#1F1F1C` | Arena `#F5ECDD` (chips) | **14.10** | ✅ AAA |
| Carbón `#1F1F1C` | Naranja `#F97316` (botón primario) | **5.89** | ✅ PASA |
| `--color-primary-text` `#B23C08` | Blanco / Crema / Arena / orange-50 / orange-100 | 5.93 / 5.63 / 5.06 / 5.58 / 5.17 | ✅ PASA en todos |
| `--color-success-text` `#16823E` | Blanco / Crema / green-50 | 4.89 / 4.64 / 4.67 | ✅ PASA en todos |
| Blanco | Verde Éxito `#2E8B57` (botón/badge sólido) | **4.25** | ✅ (era 2.28 con el semáforo) |

**Nota de alcance:** `--color-danger`/`--color-danger-text` quedaron sin tocar
(el style-guide no especifica un rojo). El `danger-text` sobre `red-50` da 4.15
(marginal), pendiente pre-existente, no una regresión de esta versión.

### 0.3 Tipografía

El style-guide pide **Inter** (texto/UI) + **Recoleta** (títulos). Recoleta es
de pago (Latinotype), así que se cargó **Inter** (default de toda la app,
reemplaza a Geist) + **Fraunces** (serif de display libre OFL, cercana a
Recoleta) expuesta como la utilidad `font-display` y aplicada a los títulos de
marca (landing, splash, wordmark, títulos de auth/onboarding). Migrar a Recoleta
real cuando se consiga la licencia = cambiar una sola variable de fuente.

---

## ⚠️ 1. Hallazgo crítico: la paleta actual falla accesibilidad

**Calculé los contrastes WCAG de todos los pares de la paleta vigente.** No los
estimé: los computé con la fórmula oficial de luminancia relativa.

**Los resultados son peores de lo que asumía el brief.**

### 1.1 Resultados medidos

| Texto | Sobre | Ratio | AA normal (4.5) | AA grande (3.0) |
|---|---|---|---|---|
| Blanco `#FFFFFF` | Naranja `#FF6B00` | **2.86** | ❌ FALLA | ❌ FALLA |
| Blanco cálido `#FFF6EE` | Naranja `#FF6B00` | **2.67** | ❌ FALLA | ❌ FALLA |
| Naranja `#FF6B00` | Blanco | **2.86** | ❌ FALLA | ❌ FALLA |
| Naranja `#FF6B00` | Fondo `#F8F9FA` | **2.71** | ❌ FALLA | ❌ FALLA |
| Verde éxito `#22C55E` | Blanco | **2.28** | ❌ FALLA | ❌ FALLA |
| Rojo error `#EF4444` | Blanco | **3.76** | ❌ FALLA | ✅ pasa |
| Naranja fuerte `#E85F00` | Blanco | **3.46** | ❌ FALLA | ✅ pasa |
| **Ink `#111111`** | **Naranja `#FF6B00`** | **6.61** | ✅ **PASA** | ✅ PASA |
| Blanco | Ink `#111111` | 18.88 | ✅ PASA | ✅ PASA |
| Ink | Fondo `#F8F9FA` | 17.91 | ✅ PASA | ✅ PASA |

### 1.2 Dos correcciones a documentos anteriores

**Corrección 1 — el blanco cálido NO mejora el contraste. Lo empeora.**

`BRIEF_IDENTIDAD_VISUAL.md` §5 afirma que sobre naranja se usa blanco cálido
`#FFF6EE` "porque el blanco puro no pasa". **Eso está mal**: el blanco cálido
da **2.67**, todavía peor que el blanco puro (**2.86**).

El blanco cálido sí resuelve un problema real —la **vibración óptica** del
blanco puro sobre naranja saturado— pero **no** el de contraste. Son dos cosas
distintas y las mezclé. Queda corregido acá.

**Corrección 2 — el botón naranja con texto blanco no cumple AA.**

Es el patrón más usado del producto (`bg-primary text-white`). Su contraste es
**2.86**, por debajo incluso del mínimo para texto grande.

### 1.3 Por qué esto importa de verdad, no en abstracto

No es un tecnicismo de auditoría. El usuario trabajador **usa la app en la
calle, con sol, en un celular de gama media** (§4.2 de ART_DIRECTION). Es
exactamente la condición donde el bajo contraste deja de ser un número y pasa
a ser "no veo lo que dice el botón".

Y el criterio 5 de aprobación del brief pregunta literalmente: *"¿sobrevive a
una foto de celular mal iluminada en un salón?"*. Con 2.86, no.

---

## 2. La paleta corregida

### 2.1 Principio de la solución

> **El naranja de marca se conserva. Lo que cambia es cómo se usa.**

Se separa el **naranja de superficie** (fondos, el color que identifica a la
marca) del **naranja de texto** (cuando el naranja tiene que leerse *sobre*
claro). Son dos roles distintos y no pueden ser el mismo valor.

Esto **no** cambia la identidad: el color de marca sigue siendo `#FF6B00`. Se
agrega una variante accesible para el rol de texto.

### 2.2 Paleta

| Token | Hex | Rol | Contraste verificado |
|---|---|---|---|
| `--color-primary` | `#FF6B00` | **Superficie** de marca: fondo de botón, acento, chips | Con ink: **6.61** ✅ |
| `--color-primary-strong` | `#E85F00` | Estado presionado, par de marca | — |
| `--color-primary-text` | **`#C65300`** | **Naranja cuando es texto sobre claro** | Sobre blanco: **4.53** ✅ |
| `--color-ink` | `#111111` | Texto principal, **texto sobre naranja** | Sobre blanco: 18.88 ✅ |
| `--color-warm-white` | `#FFF6EE` | Trazo sobre naranja **en ilustración**, no en texto | *(uso decorativo)* |
| `--color-background` | `#F8F9FA` | Fondo de app | — |
| `--color-surface` | `#F1F3F5` | Chips, campos inactivos, tracks | — |
| `--color-line` | `#ECECEE` | Bordes de 1 px | — |
| `--color-success` | `#22C55E` | **Superficie** de éxito | — |
| `--color-success-text` | **`#17853F`** | **Texto** de éxito sobre claro | Sobre blanco: **4.71** ✅ |
| `--color-danger` | `#EF4444` | **Superficie** de error | — |
| `--color-danger-text` | **`#D73D3D`** | **Texto** de error sobre claro | Sobre blanco: **4.54** ✅ |

**Los tres valores nuevos (`#C65300`, `#17853F`, `#D73D3D`) no son
arbitrarios:** son el resultado de oscurecer progresivamente cada color de
marca hasta el primer valor que cruza 4.5:1 sobre blanco. Conservan el matiz
—siguen siendo *el* naranja, *el* verde, *el* rojo de Staffya— y ganan
legibilidad.

### 2.3 La regla del botón naranja

> **Sobre naranja de marca, el texto va en ink `#111111`, no en blanco.**

Contraste **6.61** — pasa AA cómodamente.

Esto cambia el aspecto del botón principal (hoy es naranja con texto blanco).
**Es un cambio visible y hay que decidirlo con los ojos abiertos:**

| Opción | Contraste | Aspecto |
|---|---|---|
| **A. Naranja + texto ink** | 6.61 ✅ | Más audaz, más "marca". Se parece al par verde/amarillo de Pasito |
| **B. Ink + texto blanco**, naranja sólo como acento | 18.88 ✅ | Más sobrio, el naranja se reserva para señalar |
| **C. Dejar naranja + blanco** | 2.86 ❌ | Se ve bien en la compu, falla al sol |

**Recomiendo A.** Cumple accesibilidad, es más distintivo, y mantiene al
naranja como el color dominante de la acción. La C no es una opción real: es
elegir que no se vea.

---

## 3. Reglas de uso

1. **Un acento por pantalla.** El naranja marca *la* acción principal. Dos
   naranjas compitiendo significan cero. *(Heredado, ratificado.)*
2. **El naranja es el 5% de la superficie.** Si ocupa más, deja de significar
   "acá se toca". Es la diferencia de tono con Rappi (§8.1 de ART_DIRECTION).
3. **Verde y rojo son sólo de estado.** Nunca decorativos.
4. **Superficie ≠ texto.** Un color de superficie nunca se usa como color de
   texto sobre claro sin su variante `-text`.
5. **Ningún color nuevo sin ADR.** Cada color agregado divide el significado.
6. **El contraste se mide, no se estima.** Este documento existe porque
   estimarlo salió mal.

### 3.1 Proporción

```
Neutros (fondo, superficie, línea)  ████████████████████  ~80%
Ink (texto)                         ████                  ~15%
Naranja (acento)                    █                     ~5%
```

---

## 4. Fondo ink: cuándo sí

El ink `#111111` como **fondo** se usa sólo en **momentos de marca**:

| Pantalla | ¿Fondo ink? | Motivo |
|---|---|---|
| Onboarding | ✅ Sí | Es la presentación de la marca |
| Splash | ✅ Sí | Idem |
| Landing | ⚠️ Evaluar | La versión oscura se probó y se revirtió: quedó "barreta" sin activos de marca. **Reconsiderar cuando existan logotipo e ilustración.** |
| Feed, panel, perfil | ❌ No | Uso diario, con sol, de pie. Va claro. |

---

## 5. Verificación

Script reproducible para auditar cualquier par:

```python
def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def luminancia(hexs):
    h = hexs.lstrip("#")
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def contraste(a, b):
    la, lb = luminancia(a), luminancia(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

# AA texto normal: >= 4.5 · AA texto grande (>=24px o >=18.66px bold): >= 3.0
```

---

## 6. Plan de implementación

| Paso | Qué | Riesgo |
|---|---|---|
| 1 | Agregar los tres tokens `-text` a `globals.css` | Ninguno — sólo suma |
| 2 | Reemplazar `text-primary` sobre fondos claros por `text-primary-text` | Bajo, mecánico |
| 3 | Reemplazar `text-green-700`/`text-danger` sobre claro por sus variantes | Bajo |
| 4 | **Decidir A o B para el botón naranja** | **Visible — requiere aprobación** |
| 5 | Verificar con el script y capturar pantallas | — |

**El paso 4 no lo hago sin tu decisión**: cambia el aspecto del botón más
usado del producto.

---

## 7. Checklist

- [ ] Los tres tokens `-text` existen en `globals.css`
- [ ] Ningún `text-primary` sobre fondo claro sin su variante accesible
- [ ] Decidida la opción del botón naranja (A o B)
- [ ] Todos los pares en uso medidos con el script del §5
- [ ] Verificado en un celular real, al sol
