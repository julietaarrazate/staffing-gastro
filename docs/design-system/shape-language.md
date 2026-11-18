# Shape Language — Oído v5.0

Radios del board (Formas y radios). Valores en `globals.css`.

| Rol | Token | Valor | Nota |
|---|---|---|---|
| Card | `--radius-card` | 8px | La superficie base. |
| Botón | `--radius-btn` | 6px | Botones. |
| Input | `--radius-input` | 6px | Campos de formulario, search. |
| Sheet | `--radius-sheet` | 14px | Un escalón sobre la card. |
| Chip/miniatura | `--radius-chip` | 4px | Íconos cuadrados, thumbnails, etiquetas de texto. |
| Círculo | (rounded-full) | 50% | Sólo lo que es círculo: avatares, puntos, insignias redondas. |

**Escala nueva (2026-11-16).** El medidor de diseño marcó que todo estaba
redondeado por igual (16 a 32 px) y que todo parecía una tarjeta. Los radios
bajan (antes card 16, botón 12, input 12, sheet 18, chip 12) y las esquinas se
leen como filete, no como burbuja. En la landing, `--l-radio` y `--l-panel`
pasan a 12 px (10 px en celular); los botones y las etiquetas de texto ya no
son píldoras. `rounded-full` queda sólo para círculos de verdad.

**Jerarquía, no uniformidad:** las piezas no comparten un único radio. La
imagen dentro de una card toma el radio de la card menos el padding (radio
interno < externo) para que no "sobresalga" del contenedor.
