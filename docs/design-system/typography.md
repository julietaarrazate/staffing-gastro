# Typography — Oído v5.0

Todas las fuentes son **libres** (Google Fonts / OFL). Una fuente de títulos
paga (Saans, que mostraba el style-guide) se descartó por decisión de Julieta.

## Tres familias, tres roles

| Familia | Rol | Token / utilidad |
|---|---|---|
| **Fraunces** (serif) | Títulos de pantalla ("Hola, Sofía", "Camarero/a", el nombre en el perfil) y el wordmark "oído" | `--font-fraunces` → `font-display` y `font-serif` |
| **Inter** | Texto, botones, inputs **y encabezados de sección** ("Cerca tuyo", "Sobre el puesto") | `--font-inter` → `font-sans` |
| **DM Mono** | Datos y eyebrows en mayúscula (métricas, rótulos) | `--font-dm-mono` → `font-mono` |

## Por qué el título va en serif y la sección en sans

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

**Cuerpo en 14, no en 15** (decisión de Julieta, 2026-09-24): medido
renderizado, 14px era el tamaño de 199 textos contra 13 en 15px. La escala
decía 15 y describía una app que no era la que se veía; pasar todo a 15 habría
movido todos los layouts.
