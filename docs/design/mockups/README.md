# Rediseño visual de Oído — mockups

Exploración de identidad de marca e interfaz para Oído (staffing gastronómico).
Trabajo **visual / de diseño**, sin implementar todavía: son maquetas HTML
autocontenidas (abrilas en el navegador) que sirven de referencia para, cuando
esté aprobado, bajarlo a los tokens reales (`app/globals.css`) y aplicarlo por PR,
pantalla por pantalla.

## Dirección aprobada

- **Estilo: "Híbrido"** (elegido tras el comparativo `07`) — base cálida del
  diseño original, con contraste oscuro (`#191410`) **solo donde importa el
  foco** (el módulo de ganancias), y los acentos nuevos en chips y stats.
  Conserva Fraunces como display.
- **Tipografía:** se **conserva Fraunces** como display (activo de marca), con
  `Space Mono` para datos y etiquetas. (`Bricolage Grotesque` se probó en la
  dirección "Contraste" y quedó descartada con el híbrido.)
- **Acentos de identidad:** naranja (acción), **manteca** (datos), **celeste**
  (confianza/verificación).
- **Logo real** (la mano al oído), wordmark `oído` en minúscula. Sin el "damero".

## Archivos

| Archivo | Qué es |
|---------|--------|
| `01-identidad.html` | Tablero de identidad: paleta, tipografía, elementos. |
| `02-tres-direcciones.html` | Las 3 direcciones comparadas (Contraste / Aire / Cálido). Se eligió **Contraste**. |
| `03-app-claro-oscuro.html` | La app con modo claro/oscuro conmutable: inicio, buscar por categoría, detalle, perfil, panel del comercio, **ranking de perfiles con puntaje**, mapa. |
| `04-landing.html` | La landing **real de `main`** reproducida fiel (hero + ScrollHeroShowcase sticky, marquee enmascarado, StatsStrip con contadores, timeline con riel que se dibuja, bento con parallax, pricing, CTA, footer). **Único cambio: los acentos manteca y celeste** donde antes todo era naranja/arena. |
| `05-onboarding-ubicacion.html` | Onboarding de comercio y trabajador + pantalla de geolocalización (claro por defecto). |
| `06-mails.html` | Los 4 mails en **híbrido**: bloque de foco oscuro antes del CTA, naranjas corregidos, identidad en azul celeste. |
| `07-comparativo.html` | La misma pantalla en Original / Contraste / **Híbrido** — se eligió Híbrido. |
| `08-auditoria-contraste.html` | Auditoría WCAG AA de la paleta híbrida: 15/17 pasan, 2 correcciones al naranja. |
| `09-hibrido-app.html` | **La app completa en híbrido** (7 pantallas) con los naranjas ya corregidos. Referencia principal. |

## Alcance del cambio en la landing

La landing **no se rediseña**: mantiene estructura, tipografía, efectos y
copy de `main`. Lo único que se suma son los acentos, en los lugares donde
antes todo era naranja o arena:

| Dónde | Antes | Ahora |
|-------|-------|-------|
| Punto del badge del hero | naranja | manteca |
| Chips del marquee | todos blancos | algunos manteca / celeste |
| Segundo número de StatsStrip | naranja | celeste |
| Íconos del timeline (pasos 1 y 2) | blanco/arena | manteca y celeste |
| Íconos del bento (4 de 5) | `bg-surface` | manteca y celeste alternados |
| Chips de la tarjeta de turno | arena | manteca y celeste |
| Tag "Recomendado" de precios | naranja | manteca |
| Ícono del CTA de trabajadores | espresso | celeste |

## Regla de contenido

- **El monto que se publica es el de la jornada completa, no por hora.** El
  código real muestra `pay_amount` bajo el label "Pago", sin `/h`. Las maquetas
  usan montos de jornada (ej. $45.000 por un turno de 8 hs) y acompañan con la
  duración al lado.

## Pendiente / en discusión

- Correcciones de contraste: **ya aplicadas** en `09` — `--primary #F94E1B`
  (superficie), `--primary-text #D63606` (texto), `--primary-cta #DB3706`
  (botones). Manteca, celeste y el módulo oscuro pasan todos.
- Métricas del ranking (Puntualidad / Trabajo / Presentación): confirmar el set.
- Modo claro por defecto (decidido).
- Bajar la paleta a `globals.css` una vez cerrado el diseño.
