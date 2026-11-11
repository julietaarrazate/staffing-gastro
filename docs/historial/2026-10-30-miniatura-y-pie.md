# Miniatura al compartir con el «oído» actual y más links en el pie

**Pedido:** Julieta, 2026-10-30, de la lista de mejoras de la landing: la
miniatura que muestra WhatsApp al pasar el link (punto 3) y un pie con más
caminos, como el de coofounder (punto 4).

**Qué cambió:**

- **Miniatura:** al compartir `oido.com.ar`, la imagen muestra la `firma`
  actual (letra de cartel con adornos dorados, la de la pantalla de inicio)
  en vez del filete anterior al 2026-10-23 (Fraunces con flores naranjas).
  Mismo cielo y mismo tagline. Técnico: `frontend/assets/og/filete-oido.png`
  regenerado a 1200 × 609 renderizando `<Filete palabra="oído" tam="firma" />`
  con fondo transparente y optimizado con sharp (45 KB);
  `FILETE_ALTO` en `frontend/lib/og-brand.tsx` pasa a 609/1200. Sirve para
  `og:image` (`/og/oido.jpg`, cuadrada) y `twitter:image` (apaisada).
- **Pie:** además de Términos y Privacidad, links a Precios, Para trabajar,
  Preguntas frecuentes e Ingresar (`components/landing/LandingFooter.tsx`).

**Por qué así:** el PNG es la misma pieza de `Filete.tsx`, así la miniatura
no se separa de la marca. Los links del pie usan las anclas que ya existían
(`#precios`, `#trabajar`, `#preguntas`).

**Queda abierto:** la ficha de marca, el brand system y el paquete siguen
con el filete anterior (`../STATUS.md`, ítem 0). WhatsApp puede seguir
mostrando la miniatura vieja un tiempo en los links que ya se compartieron,
porque la guarda en caché.
