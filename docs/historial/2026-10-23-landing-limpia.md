# Landing más limpia (#PR)

**Pedido:** Julieta, 2026-10-23: "siento que la landing aún sigue un poco
cargada… qué está redundante, qué sacarías, qué mejorarías".

**Qué ve el usuario:**
- La ficha de Lucía ya no es una sección aparte: sus estrellas, turnos e
  "Identidad verificada" aparecen en el pie del mapa cuando "va en camino"
  (antes la misma persona salía dos veces seguidas).
- Títulos más cortos: "Alguien libre, a pocas cuadras", "Turnos cerca tuyo,
  cuando quieras" y, en el cierre, "¿Te falta alguien hoy?", pegado al
  "oído" grande.
- En escritorio todas las secciones van centradas (antes Confianza, Para
  trabajar y Preguntas iban con el título al costado).
- El pie sólo lleva Ingresar, Términos y Privacidad.
- Precios sin la etiqueta "Recomendado" (el Básico se marca con el borde) y
  la barra del Pro lisa.
- La franja celeste de la comanda se funde al blanco en vez de cortar contra
  el mapa, y hay menos aire debajo del inicio.

En el celular la página queda un 12 % más corta (5471 → 4836 px a 390 px de
ancho).

**Qué cambió (técnico):** se borra `components/landing/Confianza.tsx` y las
reglas `.landing-sec-dos`/`.landing-sec-arriba` de `globals.css`;
`MapaCamino` suma `IdentityVerifiedBadge` y la calificación en el
`figcaption`; `.landing-cierre` sin padding inferior; `.landing-cielo` con
degradé que vuelve a `--color-card`; el E2E de la landing busca el título
nuevo de Para trabajar.
