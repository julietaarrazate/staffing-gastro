# Shape Language — Oído v5.0

Radios del board (Formas y radios). Valores en `globals.css`.

| Rol | Token | Valor | Nota |
|---|---|---|---|
| Card | `--radius-card` | 16px | La superficie base. |
| Botón | `--radius-btn` | 12px | Botones y chips. |
| Input | `--radius-input` | 12px | Campos de formulario, search. |
| Sheet | `--radius-sheet` | 18px | Un escalón sobre la card. |
| Chip/miniatura | `--radius-chip` | 12px | Íconos cuadrados, thumbnails. |
| Badge/pill | (rounded-full) | 99px | Badges, píldoras de estado, avatar. |

**Jerarquía, no uniformidad:** las piezas no comparten un único radio. El
badge es pill (99), la card es media (16), el botón/input bajan a 12. La
imagen dentro de una card toma el radio de la card menos el padding (radio
interno < externo) para que no "sobresalga" del contenedor. Antes v5.0 la app
venía sistemáticamente más redondeada (card 20 / btn 15 / input 18).
