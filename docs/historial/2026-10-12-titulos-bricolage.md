# Títulos en Bricolage Grotesque; el logo sigue en Fraunces

**Pedido:** Julieta, después de la auditoría de la landing del 2026-10-11:
la tipografía se sentía "bastante usada" y genérica. Comparó cuatro
combinaciones gratuitas y eligió Bricolage Grotesque, pero sólo para los
títulos, sin modificar el resto.

**Qué ve el usuario:** los titulares de la landing y los títulos de pantalla
de la app ("¿Qué necesitás?", "Hola, Sofía", el puesto de un turno) pasan de
la serif Fraunces a Bricolage Grotesque. El texto sigue en Inter, los datos
en DM Mono y el logo "oído" en Fraunces.

**Qué cambió (técnico):**

- `frontend/app/layout.tsx`: carga `Bricolage_Grotesque` (variable, con eje
  `opsz`) como `--font-bricolage`.
- `frontend/app/globals.css`: `--font-display` apunta a `--font-bricolage`;
  `--font-serif` sigue en Fraunces.
- El wordmark usaba `font-display` en tres lugares además de `Logo.tsx`:
  `components/landing/story/LandingHeader.tsx`,
  `components/landing/story/LandingFooter.tsx` y
  `components/SplashScreen.tsx`. Pasan a `font-serif` para que el logo no
  cambie.
- Espaciado de los titulares de la landing (17 clases en
  `components/landing/story/`): el `tracking` negativo se redujo a la mitad
  porque Bricolage es más compacta y las letras se tocaban.
- `docs/design-system/typography.md` actualizado.

**Por qué así:** se descartó cambiar también el texto para no tocar las ~40
pantallas que usan Inter. La combinación tiene un costo conocido: Pasito
(otra app argentina) usa Bricolage en sus títulos.

**Queda abierto:** el resto de la auditoría de la landing (títulos con punto
final, estructura más corta, sección para trabajadores, encabezado oscuro
sobre el hero claro en escritorio).
