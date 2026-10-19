# Una sola marca arriba: el "oído" fileteado, y las barras del celular sin naranja (#PR)

**Pedido:** Julieta, 2026-10-19, mirando la landing en el celular: "¿qué
pensás del ícono genérico y el oído chiquito de arriba? Quizás quedaría
mejor poner directamente el del final, que también es el de la miniatura".

**Qué ve el usuario:**

- **Encabezado de la landing:** en vez del isotipo naranja más "oído" en
  Fraunces, va la palabra "oído" fileteada (la misma del final y de la
  miniatura), sin volutas ni flores: a ese tamaño se volvían manchitas. El
  isotipo sigue como ícono de la app (pantalla de inicio, pestaña).
- **Barra de arriba del celular:** blanca en claro y noche azul en oscuro;
  era ámbar en toda la app.
- **App instalada:** la barra de abajo deja de ser crema (`#fff8f0`).

**Qué cambió (técnico):** `components/landing/Filete.tsx` suma `tam="marca"`
(sólo la palabra, relieve fino); `LandingHeader.tsx` lo usa en lugar de
`LogoMark` y el wordmark. `app/layout.tsx` (`themeColor`) y
`app/manifest.ts` (`theme_color`, `background_color`) pasan a blanco;
`lib/theme.tsx` cambia el `meta theme-color` al tema elegido, con los dos
colores en `lib/theme-color.ts` (aparte porque `layout.tsx` es de servidor y
`theme.tsx` de cliente).

**Por qué así:** arriba competían tres versiones de la marca (isotipo,
"oído" en Fraunces y el fileteado de abajo). Queda una sola, y el naranja de
la barra del celular era el último ámbar que no era una acción.
