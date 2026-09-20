# Typography — Oído v5.0

## Tres familias, tres roles

| Familia | Rol | Token / utilidad | Estado |
|---|---|---|---|
| **Saans** | Títulos y UI (headings, labels de sección) | `--font-saans` → `font-display` | ⚠️ stand-in libre (ver abajo) |
| **Inter** | Texto e interfaz (body, botones, inputs) | `--font-inter` → `font-sans` | ✅ |
| **DM Mono** | Datos y precios (pago, horarios, métricas) | `--font-dm-mono` → `font-mono` | ✅ cargada; falta aplicarla en los componentes de precio |
| **Fraunces** (serif) | **Sólo el wordmark** "oído" | `--font-fraunces` → `font-serif` | ✅ |

## Saans es una fuente PAGA

Saans (foundry **displaay**) no se puede cargar desde Google Fonts. Hasta que
se licencie, `--font-saans` carga un **stand-in libre** (Hanken Grotesk, un
grotesco humanista cercano en tono) desde `next/font/google`. Al licenciar
Saans se cambia **sólo el import** en `frontend/app/layout.tsx` — ningún
componente se toca, porque todos consumen `font-display`.

**Decisión pendiente de Julieta:** licenciar Saans, o adoptar el stand-in (u
otro grotesco libre) como definitivo.

## El precio en mono es un gesto de marca

El board pone precios y datos en **DM Mono**. Un turno se reconoce por su pago;
en mono, con tabular figures, el número es protagonista y alineable. Los
componentes de precio (`OpportunityCard`, `ShiftCard`, `WorkerGameCard`,
detalle de turno) deben usar `font-mono` — **pendiente del pase de
componentes** (v5.0 dejó la fuente cargada y el token listo).

## Por qué el wordmark queda en serif

El logo del board es serif. Separar el wordmark (Fraunces, `font-serif`) de los
títulos de UI (Saans, `font-display`) permite que las pantallas se vean
modernas/sans sin perder el carácter editorial de la marca en el logo. Antes
ambos compartían `font-display`; el split se hizo en `components/Logo.tsx`.

## Escala

La escala tipográfica (`--text-display` … `--text-metadata`, con line-heights
emparejados) vive en `globals.css` y no cambió en v5.0 — sólo cambiaron las
FAMILIAS. Jerarquía: display/h1/h2/h3 (Saans) · body/body-strong/caption
(Inter) · price/metric/data (DM Mono) · label/eyebrow (mono, uppercase).
