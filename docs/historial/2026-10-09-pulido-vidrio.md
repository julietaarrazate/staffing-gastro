# Pulido después del vidrio esmerilado

**Pedido:** Julieta, 2026-10-09, en el hilo "Identidad de marca de Oído":
"¿Qué creés que le falta pulir?", después de #412. Se le pasó la lista y se
arreglaron los cuatro puntos que eran de código.

**Qué cambió:**
- El cromo (encabezado y barra de abajo) pasó del 72% al 92% en claro y al
  94% en oscuro. Con el 72%, el saludo de Inicio se leía a través del logo.
- El velo ámbar de arriba sube de intensidad (de 22% a 30% en el centro):
  en claro casi no se veía.
- La etiqueta "Urgente" y la flecha de la tarjeta destacada llevan sombra y
  un borde fino: eran blancas sobre la tarjeta blanca (`bg-glow`) y se
  perdían.
- Las miniaturas sin foto de "Cerca tuyo" (`.rubro-tile`) son blancas en
  claro. El tinte crema/naranja era de la paleta v5.

**Trampa:** en Chromium headless (las capturas de Playwright de la sesión
cloud) el `backdrop-filter` del encabezado no desenfoca dentro de la app,
aunque el valor computado es correcto y una página suelta sí desenfoca. No se
encontró la causa. Por eso la opacidad del cromo se fijó alta, para que se
vea bien aunque el desenfoque no se aplique.

**Isotipo:** se le propusieron tres alternativas (una "o" con ondas, "¡o!",
una oreja en un trazo; lámina en
`/mnt/project-files/design-system/isotipo/`). Eligió **dejar el actual**.
