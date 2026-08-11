/**
 * Tokens de motion (ART_DIRECTION.md §13.3, DESIGN_TOKENS.md §3.7 — "a
 * crear"). Reflejan los mismos valores que `--motion-*` en `globals.css`;
 * viven duplicados acá porque Framer Motion necesita números de JS, no
 * strings de CSS var, en su prop `transition`. Si cambia uno, cambia el otro.
 *
 * Sin rebote a propósito (§13.2): la llegada seca comunica precisión, no
 * juego. Por eso la curva es la misma para UI y marca — sólo cambia la
 * duración.
 */
export const MOTION_EASE: [number, number, number, number] = [0.2, 0, 0, 1];

/** Transiciones de interfaz: hojas, tooltips, fade de contenido. */
export const MOTION_UI = { duration: 0.2, ease: MOTION_EASE };

/** El gesto de marca: algo que llega y se asienta (splash, revelado de landing). */
export const MOTION_BRAND = { duration: 0.5, ease: MOTION_EASE };

/** Feedback táctil (`whileTap`) — mismo valor que usa `Button.tsx`. */
export const MOTION_PRESS_SCALE = 0.96;
