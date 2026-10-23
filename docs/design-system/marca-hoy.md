# La marca hoy (ficha corta)

> Estado al **2026-10-19**. Una página para arrancar sin leer el historial.
> Brand system navegable para el diseñador (colores en los dos temas,
> tipografía, piezas y logos en vector): https://claude.ai/artifact/J8s5yUUpW3Ufz2hbWKYYns
> (privado: compartirlo desde su menú Share). Los vectores también están en
> [`marca/`](./marca/).

## En una frase

**Celeste y blanco con un solo ámbar**, porteña y gastronómica: el cielo de
Buenos Aires, el papel de la comanda y el filete de los carteles de bodegón.

## Reglas

1. **Una idea por sección** en la landing: título y una cosa. Sin subtítulos,
   etiquetas ni textos grises que repitan la imagen.
2. **Un solo ámbar por pantalla** (`--color-primary` `#D97706`, letra en
   tinta): la acción principal. Links, chips, avatares, íconos de rubro y
   pestaña activa van en celeste con azul hondo `#1C5478`.
3. **La marca es una sola: el «oído» fileteado** (`components/landing/Filete.tsx`):
   - `firma` (con adornos finos dorados): pantalla de inicio;
   - el final de la landing: la palabra grande, cortada por el borde, con el
     Sol de Mayo saliendo detrás (como el cierre de coofounder);
   - `marca` (sólo la palabra): encabezado de la landing;
   - `cinta` («¡Oído!»): la comanda.
   La miniatura para compartir todavía usa el filete anterior (pendiente).
   No va en ningún otro lugar ni con otra palabra.
4. **Isotipo provisorio:** el de siempre (manos y oreja, `public/logo-mark.svg`)
   en **blanco sobre azul hondo `#1C5478`** desde el 2026-10-19 (era crema
   sobre ámbar). Es el ícono de la app (pantalla del celular, arranque en
   Android, pestaña) y el logo chico del encabezado dentro de la app. Falta
   diseñar uno nuevo.
5. **Modo oscuro = noche azul** (lienzo `#0D131A`, tarjeta `#151D26`, grises
   fríos, brillo celeste). Nada de café ni resplandor naranja.
6. Barra del celular (`theme-color`) blanca en claro, noche azul en oscuro.

## Paleta

| Rol | Claro | Oscuro |
|---|---|---|
| Lienzo | `#F8FBFC` | `#0D131A` |
| Tarjeta | `#FFFFFF` | `#151D26` |
| Recesado | `#E5EEF1` | `#1C2631` |
| Tinta / suave / apagada | `#111111` / `#4B5563` / `#686572` | `#EEF3F6` / `#A9B6C2` / `#8494A3` |
| Celeste / fuerte / tinte | `#C4E3ED` / `#9AC9E7` / `#DEECF0` | velo celeste 12–14 % / `#9AC9E7` |
| Azul hondo (links, letra sobre celeste) | `#1C5478` | `#9AC9E7` |
| Ámbar (acción) / como texto | `#D97706` / `#B45309` | `#D97706` / `#E8920F` |
| Filete (desde el 2026-10-23): cara crema, filete interior blanco, borde y relieve azul hondo, canto dorado; adornos finos y Sol de Mayo dorados | `#FFF9DC` → `#F2DC9A`, `#FFFFFF`, `#14456A` / `#1C5478`, `#C98A1A`; oro `#B8801F` `#E2B04A` | igual |

Detalle y contrastes: [`color-system.md`](./color-system.md).

## Tipografía

| Familia | Uso |
|---|---|
| **Schibsted Grotesk** | Títulos de la landing y de pantalla (desde el 2026-10-18; antes Bricolage, "muy infantil") |
| **Inter** | Texto, botones, inputs |
| **DM Mono** | Rótulos de la comanda, horarios |
| **Sancreek** | Sólo la palabra «oído» fileteada (letra de cartel con espolones, desde el 2026-10-23; recorte local de 1,5 KB) |
| **Fraunces** | El wordmark chico de la app (`components/Logo.tsx`) |

Detalle: [`typography.md`](./typography.md).

## Piezas propias

La comanda impresa con la cinta «¡Oído!», el mapa «va en camino» sobre
Palermo dibujado, la rueda de fotos del inicio y la miniatura al compartir.

## Pendiente

- **Isotipo nuevo** que dialogue con el filete (con un diseñador).
- **Fotos propias** de locales porteños (hoy son de banco).
- Una **cita real** de un local cuando haya locales usando Oído.

## Descartado

La noche atada al scroll, personajes de gelatina, vidrio y burbujas, el mapa
de puntos, paletas coral/albahaca/menta/rosa, la barra fija abajo, botones
por plan, el cartel fileteado entero en la comanda, el modo oscuro café.

## Dónde se decidió

`docs/historial/`: `2026-10-18-landing-cielo`, `2026-10-18-miniatura-filete`,
`2026-10-18-titulos-schibsted`, `2026-10-19-app-noche-azul`,
`2026-10-19-marca-filete-header`, `2026-10-19-splash-filete`.
