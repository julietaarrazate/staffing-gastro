# Typography — Oído v5.0

Todas las fuentes son **libres** (Google Fonts / OFL). Una fuente de títulos
paga (Saans, que mostraba el style-guide) se descartó por decisión de Julieta.

## Cuatro familias, cuatro roles

| Familia | Rol | Token / utilidad |
|---|---|---|
| **Young Serif** | Títulos de pantalla ("Hola, Sofía", "Camarero/a", el nombre en el perfil) y titulares de la landing. Un solo peso (400) | `--font-young-serif` → `font-display` |
| **Shrikhand** | Sólo la palabra «oído»: fileteada (`components/landing/Filete.tsx`) o plana (encabezado de la landing y de la app, `components/Logo.tsx`). Desde el 2026-11-17 (antes Sancreek). Recorte local con "o í d O ¡ !" (`frontend/app/fonts/shrikhand-oido.woff2`, 1,5 KB): otra palabra cae a la serif de respaldo | `--font-shrikhand` → `font-oido` |
| **Inter** | Texto, botones, inputs **y encabezados de sección** ("Cerca tuyo", "Sobre el puesto") | `--font-inter` → `font-sans` |
| **DM Mono** | Datos y eyebrows en mayúscula (métricas, rótulos) | `--font-dm-mono` → `font-mono` |

## La landing: letra mixta (2026-11-18)

Decisión de Julieta sobre la prueba híbrida
([`direccion-relieve.md`](./direccion-relieve.md)). La landing ya **no usa
Young Serif ni DM Mono**. Sus tres letras se cargan sólo ahí
(`frontend/components/landing/letras.ts`), no en el layout raíz:

| Familia | Dónde | Variable / clase |
|---|---|---|
| **Sedgwick Ave Display** («brocha») | Sólo donde habría un cartel pintado: el título del inicio, el del cierre y los nombres de la carta (y el plan en la pizarra). Siempre en mayúsculas | `--font-brocha` → `.landing-cartel` |
| **Abril Fatface** | Títulos de sección. Es la hermana derecha de la Shrikhand del «oído». Un solo peso | `--font-abril` → `.landing-h2` |
| **Mansalva** | Lo anotado a mano: «sugerencia de la casa», la tiza de la pizarra. En azul hondo sobre papel | `--font-mano` → `.landing-mano` |
| **Inter** | Todo el texto, los precios y las preguntas | `font-sans` |

La brocha no va con barras ni signos raros («Mozo/a» se leía «MOZOIA»): si un
texto los tiene, va en Inter. En la app todavía no rige; ahí sigue la tabla de
arriba hasta que cada pantalla migre.

## Cambio de títulos a Young Serif (2026-11-16)

El medidor de diseño marcó la letra de los títulos (Schibsted Grotesk) como
neutra: una grotesca más, sin voz. Pasan a **Young Serif** (libre, OFL), una
serif con cuerpo y algo de cartel de diario que se lleva con el filete. Mismo
rol, `font-display`; el texto, los botones, los inputs (Inter), los datos
(DM Mono) y el wordmark no cambian. Tiene **un solo peso**: `globals.css`
fuerza `font-weight: 400` y `font-synthesis-weight: none` sobre `.font-display`
y sobre las reglas de la landing que usan `var(--font-display)`, así que
`font-semibold`/`font-bold` en un título no fabrican una negrita falsa. Como
es más ancha que Schibsted, hay que mirar los títulos a 320 y 390 px.

**Cifras de caja alta (2026-11-16).** Young Serif trae las cifras old-style
por defecto (los 3, 4, 5, 7 y 9 bajan de la línea: «$45.000» se veía
descolgado). La fuente incluye la feature `lnum`, así que `.font-display` y
las reglas de `globals.css` que usan `var(--font-display)` a mano llevan
`font-feature-settings: "lnum" 1`. No usar `font-variant-numeric` para esto:
choca con `tabular-nums` de Tailwind.

## Cambio de títulos a Schibsted Grotesk (2026-10-18, reemplazado)

Julieta veía Bricolage Grotesque "muy infantil para Oído", sobre todo al lado
del filete porteño de la landing, y además es la fuente de títulos de Pasito.
Se compararon Inter Tight, Schibsted Grotesk, Instrument Sans, Hanken Grotesk
y Geist; quedó **Schibsted Grotesk** (libre, OFL): firme y con algo de cartel
o diario, sin el tono lúdico. Mismo rol que Bricolage, `font-display`; el
texto, los datos y el wordmark no cambian. Los titulares grandes de la
landing aflojan el espaciado de `-0.045em` a `-0.035em` porque las letras se
tocaban.

## Cambio de títulos a Bricolage Grotesque (2026-10-12, reemplazado)

Julieta sentía que Fraunces con Inter daba una sensación genérica, de
plantilla. Comparó cuatro combinaciones gratuitas y eligió **Bricolage
Grotesque sólo para los títulos**, sin tocar el texto (Inter) ni los datos
(DM Mono). El wordmark "oído" siguió en Fraunces para no cambiar el logo
(hasta el 2026-11-17: desde entonces la palabra es Shrikhand, `font-oido`, y
Fraunces ya no se carga).

Bricolage es más compacta que Fraunces: el espaciado negativo de los
titulares de la landing se redujo a la mitad (por ejemplo, `-0.03em` pasó a
`-0.015em`). Tiene eje de tamaño óptico (`opsz`), así que se ajusta sola
entre títulos chicos y carteles.

## Por qué el título y la sección usan familias distintas (historia)

Así lo resuelven las pantallas del board de Julieta: el título grande de cada
pantalla y los títulos de contenido (el puesto de un turno, el nombre de una
persona) van en serif — es lo que le da el tono editorial/hospitality — y los
encabezados de sección y la información operativa van en sans. Serif para lo
que se *lee como titular*, sans para lo que se *escanea*.

Durante la iteración de v5.0 se probó un grotesco (Hanken Grotesk) en los
títulos; se volvió a Fraunces al comparar contra el board.

## El precio

**No se toca** (decisión de Julieta): los componentes de precio conservan su
tipografía actual; DM Mono no se aplica a los montos.

## Escala

La escala tipográfica (`--text-display` … `--text-metadata`, con line-heights
emparejados) vive en `globals.css`, y es la **única** fuente de tamaños: un
tamaño nuevo se agrega como token, no como `text-[Npx]` suelto
(`lib/type-scale.test.ts` falla si aparece uno fuera de las excepciones
listadas ahí).

| Token | Tamaño | Para qué |
|---|---|---|
| `text-h1` | 28px | Título de pantalla ("Hola, Juana", "Candidatos") **y** título de contenido (el puesto en una tarjeta o en el detalle). Fraunces. |
| `text-h3` | 18px | Encabezado de sección ("Qué incluye", "Cerca tuyo"). Inter. |
| `text-price` | 39px | El monto del pago. |
| `text-body` | **14px** | Cuerpo. Es el mismo tamaño que `text-sm`; lo nuevo usa `text-body`. |
| `text-caption` | 13px | Texto secundario. |
| `text-metadata` | 12px | Horas, letra chica. |
| `text-label` | 11px | Eyebrows y chips. **Piso**: debajo no va texto. |

**Inputs en celular: 16px** (2026-11-17, U044). `globals.css` lleva `input`, `select` y `textarea` a 16px bajo 768px de ancho: con menos, iOS Safari hace zoom al enfocar. Es una excepción a `text-body`; el alto y el padding no cambian.

**Cuerpo en 14, no en 15** (decisión de Julieta, 2026-09-24): medido
renderizado, 14px era el tamaño de 199 textos contra 13 en 15px. La escala
decía 15 y describía una app que no era la que se veía; pasar todo a 15 habría
movido todos los layouts.
