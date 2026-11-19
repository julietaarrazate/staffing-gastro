/**
 * Las nubes del cielo (`.app-cielo`, ADR-0028, tercera vuelta): imágenes con
 * volumen y transparencia, hechas por `scripts/build-nubes.mjs`. Decorativas
 * (`alt=""`, `aria-hidden`): la pantalla las pone adentro de su cielo, que
 * además lleva `.cielo-limpio` para apagar las manchas viejas.
 *
 * Pocas y con intención: una grande que asoma por el borde y a lo sumo una
 * chica «de lejos» (`lejos`, más tenue). Nunca detrás de un texto: la
 * posición es de quien las usa. Derivan muy despacio (se apaga con
 * `prefers-reduced-motion`) y de noche no se ven (quedan las estrellas).
 */
type Forma = "a" | "b" | "c";

/** Tamaño propio de cada imagen (declarado para que no salte el layout). */
const TAMANO: Record<Forma, { w: number; h: number }> = {
  a: { w: 840, h: 500 },
  b: { w: 680, h: 480 },
  c: { w: 1160, h: 420 },
};

export interface NubeCielo {
  forma: Forma;
  /** Ancho en px de pantalla; el alto sale de la proporción. */
  ancho: number;
  /** Posición dentro del cielo (`right`, `top`, `left`, `bottom`; px o CSS). */
  pos: { top?: number | string; right?: number | string; bottom?: number | string; left?: number | string };
  /** Chica y más tenue: una nube «de lejos». */
  lejos?: boolean;
}

export default function NubesCielo({ nubes }: { nubes: NubeCielo[] }) {
  return (
    <>
      {nubes.map((n, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- decorativa, ya viene en WebP del tamaño justo
        <img
          key={i}
          src={`/cielo/nube-${n.forma}.webp`}
          alt=""
          aria-hidden
          width={TAMANO[n.forma].w}
          height={TAMANO[n.forma].h}
          loading="eager"
          decoding="async"
          draggable={false}
          className={`nube-cielo${n.lejos ? " nube-cielo-lejos" : ""}`}
          style={{ width: n.ancho, ...n.pos }}
        />
      ))}
    </>
  );
}
