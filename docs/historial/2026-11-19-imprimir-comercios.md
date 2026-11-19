# Comercios a captar: botón «Imprimir» para la ruta de visitas

**Pedido:** Julieta quería llevar la ruta de visitas impresa o guardarla como PDF, al lado del botón «CSV» de Administración → Crecimiento → «Comercios».

**Qué cambió:** el botón «Imprimir» (ícono `Printer`, deshabilitado con la lista vacía) llama a `window.print()`. Se imprime la misma lista que está en pantalla (barrio y filtro de estado, mismo orden): título «Comercios a captar · <Barrio>», filtro, cantidad y fecha en hora de Argentina, una tabla con casillero para tachar, nombre y rubro, dirección, teléfono, Instagram, estado y una columna «Notas» en blanco, y al pie la atribución de OpenStreetMap (ODbL). Las filas no se cortan entre hojas y el encabezado se repite en cada una.
- `frontend/components/admin/ComerciosImprimir.tsx` (nuevo): oculto en pantalla, visible con `print:`.
- `frontend/app/admin/leads/page.tsx`: botón, y `print:hidden` en todo lo interactivo.
- `Navbar`, `BottomNav`, menú de `app/admin/layout.tsx` y el relleno inferior de `<main>`: sólo la clase `print:hidden` / `print:pb-0`.
- `frontend/app/globals.css`: `@page { margin: 12mm }` y fondo blanco al imprimir.
- `ComerciosImprimir` escucha `beforeprint`/`afterprint`: pasa `<html>` a `data-theme="light"` y lo restaura, así sale letra oscura sobre blanco aunque la app esté en oscuro.
- E2E `frontend/e2e/admin-leads.spec.ts`: el botón llama a `window.print`, la hoja se ve en `print` sin barras, y capturas `admin-leads-imprimir-{light,dark}`.

**Por qué así:** sin librerías de PDF: el diálogo de impresión del navegador ya guarda como PDF. El tema claro se fuerza con `beforeprint`/`afterprint` (el `ThemeProvider` no observa el atributo) en vez de duplicar ~40 tokens en el CSS, que se desincronizarían con la paleta. Los tests existentes de la pantalla usan `.first()` porque la hoja imprimible repite los nombres en el DOM.

**Queda abierto:** nada.
