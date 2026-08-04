# TYPOGRAPHY_SYSTEM.md — Sistema tipográfico de Staffya

> Fase 3.2 del roadmap de [ART_DIRECTION.md](./ART_DIRECTION.md).
> Define qué tipografías usa Staffya, por qué, y cómo se aplican.
>
> **Prioridad 1 del roadmap:** es el cambio de mayor impacto perceptual por
> menor costo. No requiere ilustrador ni presupuesto.
>
> Preparado: 2026-07-28 · Versión 1.0

---

## 1. Diagnóstico: por qué la tipografía actual no alcanza

Staffya usa **Geist** (Vercel) para todo. Geist es una buena tipografía de
interfaz: legible, bien espaciada, moderna.

**El problema no es su calidad. Es que no dice nada.**

Geist es la tipografía por defecto del ecosistema Vercel. Miles de productos
la usan exactamente igual. Un usuario no puede distinguir una pantalla de
Staffya de cualquier otra app construida con el mismo stack — y eso es,
literalmente, el diagnóstico que abrió este proceso ("se ve genérica, podría
ser cualquier producto").

**Una tipografía de sistema es correcta para leer. No sirve para reconocer.**

---

## 2. Estructura de tres niveles

| Nivel | Rol | Dónde vive |
|---|---|---|
| **Display** | Logotipo, títulos de marketing, cifras grandes | Landing, onboarding, el pago del feed |
| **Texto (UI)** | Todo el producto | Botones, formularios, listas, cuerpos |
| **Mono** | Datos técnicos, anotaciones de sistema | Códigos, timestamps, IDs |

**La personalidad vive en el display.** El texto tiene que desaparecer: si el
usuario nota la tipografía del cuerpo mientras lee un turno, algo está mal.

---

## 3. Criterios de selección del display

No se elige "la que más gusta". Se elige contra estos seis criterios, en este
orden:

### 3.1 Los seis criterios

| # | Criterio | Por qué | Cómo se verifica |
|---|---|---|---|
| 1 | **Grotesca contemporánea** | La serif dice tradición (falso: Staffya tiene un año). La geométrica pura dice tech frío. | Inspección |
| 2 | **Peso alto disponible** (≥700) | Los importes necesitan presencia. §9.4 de ART_DIRECTION pide dos escalones de diferencia. | Ver pesos publicados |
| 3 | **Números tabulares** | Un feed donde los importes bailan al pasar de tarjeta se ve amateur. | `font-feature-settings: "tnum"` o versión tabular |
| 4 | **Castellano completo** | tildes, `ñ`, `¿`, `¡`, `ü`, `Á`, `É`, `Í`, `Ó`, `Ú` | **Se prueba renderizando, no se asume** |
| 5 | **Licencia viable** | Presupuesto acotado (§7 del brief) | Leer la licencia |
| 6 | **Un detalle idiosincrático** | Sin algo reconocible es una neutral más | Inspección de `a`, `g`, `y`, terminales |

### 3.2 Por qué el criterio 4 no es opcional

Muchas tipografías populares en el mundo anglosajón tienen **soporte
incompleto de castellano**: falta la `ñ`, o los signos de apertura `¿` `¡`
están mal dibujados (simplemente rotados), o las tildes chocan con las
mayúsculas.

Staffya es **100% en español rioplatense**. Una tipografía que dibuja mal la
`ñ` es inaceptable, por linda que sea.

**Prueba obligatoria antes de aprobar cualquier candidata:**

```
¿Cuántos años tenés? ¡Postulate ya!
ñandú · señor · mañana · añejo
ÁÉÍÓÚÜÑ áéíóúüñ
Camarón · Bebé · Jamón · Sábado
ARS 19.000 · 25 km · 4,85 ★
```

Si algo de esa línea se ve mal, la candidata queda descartada. Sin excepción.

---

## 4. Recomendación: Archivo (Omnibus-Type)

### 4.1 La decisión

> **Display: `Archivo` — Omnibus-Type, Buenos Aires.**

### 4.2 Por qué

**1. Es argentina, y eso es una decisión estratégica, no sentimental.**

[Omnibus-Type](https://www.omnibus-type.com/) es una fundición colectiva **con
sede en Buenos Aires**. Archivo fue diseñada por **Héctor Gatti**.

Staffya es un producto argentino, en español rioplatense, para el mercado
argentino. Usar una fundición local **le da a la marca una historia real que
contar** — y frente a un inversor, eso se lee como criterio, no como ahorro.
Es exactamente el tipo de decisión que separa una identidad pensada de una
elegida por catálogo.

**2. Es open source, con licencia SIL OFL.**

Uso comercial libre: web, impresos, **logotipos** y apps, sin pagar licencia.
Esto importa: muchas licencias de fundición **prohíben usar la tipografía en
un logotipo** sin un acuerdo aparte. La OFL no.

**3. Es una grotesca contemporánea con pesos altos.**

Cumple los criterios 1 y 2. Es la fuente más usada de Omnibus-Type en Google
Fonts, lo que además implica mantenimiento activo.

**4. Castellano nativo.**

Diseñada en Argentina por argentinos. El soporte de castellano no es una
extensión agregada después: es el idioma de partida. *(Igual se aplica la
prueba del §3.2 antes de aprobar — no se asume nada.)*

**5. Costo cero.**

Con el presupuesto del brief (300–800 USD para todo el paquete de identidad),
gastar en licencia tipográfica sería sacárselo al logotipo o a la ilustración,
que es donde no hay alternativa gratuita de calidad.

### 4.3 Corrección a ART_DIRECTION.md §9.2

El documento anterior listaba **"Archivo / Libre Franklin (Omnibus-Type)"**.
**Eso es incorrecto y se corrige acá:**

- **Archivo** → sí es de Omnibus-Type (Héctor Gatti).
- **Libre Franklin** → **no** es de Omnibus-Type. Es de **Impallari Type**
  (Pablo Impallari, argentino de Rosario, y Rodrigo Fuenzalida), y es una
  reinterpretación de la Franklin Gothic de Morris Fuller Benton (1912).

Libre Franklin sigue siendo una candidata válida —y también tiene raíz
argentina— pero **la atribución estaba mal** y quedaba registrada en la fuente
de verdad. Corregido.

### 4.4 Alternativas evaluadas

| Candidata | Fundición | Por qué no (todavía) |
|---|---|---|
| **Libre Franklin** | Impallari Type (AR) | Excelente y también argentina. Más clásica que Archivo; menos contemporánea. **Segunda opción real.** |
| **Söhne** | Klim (NZ) | Calidad excepcional, pero licencia paga. Consumiría el presupuesto del logotipo. |
| **PP Neue Montreal** | Pangram Pangram | Muy de moda 2023-2025 — riesgo de envejecer marcada por su época. |
| **GT America** | Grilli Type | Licencia paga. Sin ventaja decisiva sobre Archivo. |
| **Instrument Sans** | — | Buena y gratis, pero sin anclaje ni carácter diferencial. |
| **Bricolage Grotesque** | — | Carácter fuerte, quizá demasiado expresiva para datos de pago. |

---

## 5. Texto (UI): se mantiene Geist

**No se cambia.** Motivos:

1. **Funciona.** Rinde bien en pantallas de gama media, que es el parque real
   de los usuarios (§4.2 de ART_DIRECTION).
2. **Ya está integrada** vía `next/font`, con subsetting y preload resueltos.
3. **No compite con el display.** Una neutral de texto es exactamente lo que
   debe ser: invisible.
4. **Cambiarla es trabajo sin retorno.** El diagnóstico de genericidad se
   resuelve en el display, no en el cuerpo.

> **Regla:** Geist nunca aparece en el logotipo ni en un título de marketing.
> Si un título necesita presencia, es Archivo.

---

## 6. Mono: DM Mono o Geist Mono

Uso marginal (timestamps, IDs, anotaciones de sistema). **Geist Mono** ya está
disponible y es coherente con el texto. No amerita una decisión aparte.

---

## 7. Escala tipográfica

Escala modular **1.25** (tercera mayor), heredada de ART_DIRECTION §9.4:

| Token | px | rem | Uso |
|---|---|---|---|
| `text-xs` | 12 | 0.75 | Etiquetas, metadatos |
| `text-sm` | 14 | 0.875 | Texto secundario |
| `text-base` | 16 | 1 | Cuerpo. **Nunca menos para texto de lectura.** |
| `text-lg` | 20 | 1.25 | Subtítulos |
| `text-xl` | 25 | 1.5625 | Títulos de sección |
| `text-2xl` | 31 | 1.9375 | Títulos de pantalla |
| `text-3xl` | 39 | 2.4375 | El dato que decide (pago) |
| `text-4xl` | 49 | 3.0625 | Marketing, hero de landing |

### 7.1 La regla de la jerarquía brutal

> **El elemento dominante de cada pantalla está al menos DOS escalones por
> encima del siguiente.**

Si están a un escalón, **compiten** — y competir es no tener jerarquía.

**Este no es un principio teórico: es un bug real ya corregido.** En el feed,
el pago estaba en `text-3xl` y el título del puesto también. Se veían igual de
importantes cuando el pago es *la* variable de decisión. Peor: al agrandarlo
demasiado (44 px) empujó el contenido fuera del alto disponible y recortó la
tarjeta.

El valor correcto salió de mirar la pantalla real, no de la teoría: **pago
a 36 px, título del hero a 30 px**, con el resto del cuerpo muy por debajo.

---

## 8. Reglas de uso

### 8.1 Pesos

| Peso | Uso |
|---|---|
| 400 Regular | Cuerpo de texto |
| 500 Medium | Etiquetas, texto secundario con énfasis |
| 600 Semibold | Botones, títulos de tarjeta |
| 700 Bold | Títulos de pantalla |
| 800 Extrabold | **Sólo** el dato dominante y el logotipo |

**Nunca más de tres pesos por pantalla.** Más pesos es menos jerarquía.

### 8.2 Números

**Tabulares siempre** en listas y tarjetas comparables:

```css
font-variant-numeric: tabular-nums;
```

Sin esto, los importes cambian de ancho al pasar de una tarjeta a otra y el
feed "salta". Es el detalle que separa un producto cuidado de uno armado.

### 8.3 Interletrado (tracking)

| Tamaño | Tracking |
|---|---|
| ≥ 31 px (títulos) | `-0.02em` — los tamaños grandes necesitan cerrarse |
| 16–25 px | `0` |
| ≤ 14 px en mayúsculas | `+0.04em` — las versalitas necesitan aire |

### 8.4 Interlineado

| Contexto | Line-height |
|---|---|
| Títulos display | 1.05–1.15 |
| Cuerpo | 1.5 |
| Texto denso (tarjetas) | 1.4 |

### 8.5 Longitud de línea

**Máximo 70 caracteres** para texto de lectura. En mobile esto casi nunca es
un problema, pero sí en la landing en escritorio.

---

## 9. Implementación técnica

### 9.1 Carga

```ts
// app/layout.tsx — patrón ya usado con Geist
import { Archivo } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"], // latin-ext: necesario para castellano completo
  weights: ["600", "700", "800"],  // sólo los pesos que se usan en display
  variable: "--font-display",
  display: "swap",
});
```

**`latin-ext` no es opcional.** Sin ese subset faltan glifos del castellano.

**Sólo los pesos que se usan.** Cada peso extra es peso de descarga real para
un usuario con datos móviles.

### 9.2 Tokens

```css
@theme {
  --font-display: var(--font-archivo);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

### 9.3 Presupuesto de rendimiento

| Métrica | Objetivo |
|---|---|
| Peso total de fuentes | **< 120 KB** |
| Pesos de display cargados | Máximo 3 |
| `font-display` | `swap` (nunca texto invisible) |

**Justificación:** el usuario trabajador abre la app en el colectivo, con
datos móviles y batería al 20% (§4.2 de ART_DIRECTION). Cada KB cuenta.

---

## 10. Checklist de aprobación

Antes de dar por cerrado el cambio tipográfico:

- [ ] La línea de prueba del §3.2 renderiza correctamente en **Archivo**
- [ ] La `ñ` y los signos `¿` `¡` están **dibujados**, no rotados
- [ ] Los números son tabulares y no saltan entre tarjetas del feed
- [ ] El peso total de fuentes está bajo 120 KB
- [ ] La jerarquía del §7.1 se cumple en feed, panel y onboarding
- [ ] `next build` pasa y el LCP no empeoró
- [ ] La licencia OFL está incluida en el repo

---

## 11. Qué falta y quién lo hace

| Tarea | Quién |
|---|---|
| Verificar la línea de prueba en Archivo | **Yo** — se puede renderizar y mirar |
| Implementar la carga y los tokens | **Yo** |
| Ajustar la jerarquía de cada pantalla | **Yo** |
| **Dibujar el logotipo con Archivo como base** | **Diseñador** |

> El logotipo **no** es "escribir staffya en Archivo". Es tomar esa base y
> ajustarla a mano: espaciado óptico, quizá una ligadura en el "ya", terminales
> retrabajadas. Eso lo hace una mano entrenada. Archivo es el punto de partida,
> no el resultado.

---

## Fuentes

- [Omnibus-Type — sitio oficial](https://www.omnibus-type.com/)
- [Archivo — Omnibus-Type](https://www.omnibus-type.com/fonts/archivo/)
- [Omnibus-Type en GitHub](https://github.com/omnibus-type)
- [Press Series by Omnibus-Type — Google Fonts](https://googlefonts.github.io/omnibus/)
- [Libre Franklin — Google Fonts](https://fonts.google.com/specimen/Libre+Franklin)
- [Archivo — Wikipedia](https://en.wikipedia.org/wiki/Archivo)
