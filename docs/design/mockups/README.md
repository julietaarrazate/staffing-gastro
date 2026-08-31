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
| `04-landing.html` | Landing en **híbrido**, con el stack de tarjetas que rota al scrollear, reveals y micro-parallax. |
| `05-onboarding-ubicacion.html` | Onboarding de comercio y trabajador + pantalla de geolocalización (claro por defecto). |
| `06-mails.html` | Los 4 mails en **híbrido**: bloque de foco oscuro antes del CTA, naranjas corregidos, identidad en azul celeste. |
| `07-comparativo.html` | La misma pantalla en Original / Contraste / **Híbrido** — se eligió Híbrido. |
| `08-auditoria-contraste.html` | Auditoría WCAG AA de la paleta híbrida: 15/17 pasan, 2 correcciones al naranja. |
| `09-hibrido-app.html` | **La app completa en híbrido** (7 pantallas) con los naranjas ya corregidos. Referencia principal. |

## Pendiente / en discusión

- Correcciones de contraste: **ya aplicadas** en `09` — `--primary #F94E1B`
  (superficie), `--primary-text #D63606` (texto), `--primary-cta #DB3706`
  (botones). Manteca, celeste y el módulo oscuro pasan todos.
- Métricas del ranking (Puntualidad / Trabajo / Presentación): confirmar el set.
- Modo claro por defecto (decidido).
- Bajar la paleta a `globals.css` una vez cerrado el diseño.
