import { variantePorId, type VariantePortada } from "./PortadaCielo";

/**
 * El reemplazo de la foto que falta (la de una persona, el logo de un
 * comercio): un pedacito de cielo (ADR-0028), nunca un color liso. Es el
 * mismo cielo de `PortadaCielo` (clases `.portada-cielo` de la portada de un
 * turno sin foto, las mismas imágenes de nube), a la medida de un círculo:
 * el degradé con su luz, una nube con volumen que asoma por abajo y la
 * inicial encima, en la tinta del cielo (`.portada-tinta`).
 *
 * - Llena su contenedor; el contenedor pone el tamaño y el recorte
 *   (`overflow-hidden` y el radio, redondo o de esquinas redondeadas). La
 *   letra y la nube escalan con él (unidades de contenedor), así que sirve de
 *   40 a 120 px sin ajustes.
 * - La nube cambia con `id` (tres variantes, hash estable): una lista sin
 *   fotos no parece clonada. Sin `id` se usa el nombre.
 * - `tamano` (px, opcional): por debajo de 36 px la nube no entra y queda el
 *   degradé con la inicial. Sin `tamano` se da por grande.
 * - Decorativa (`aria-hidden`): el nombre ya está escrito al lado.
 */
const NUBE: Record<VariantePortada, { w: number; h: number; ancho: number; right: number; bottom: number }> = {
  a: { w: 840, h: 500, ancho: 122, right: -24, bottom: -30 },
  b: { w: 680, h: 480, ancho: 90, right: -10, bottom: -26 },
  c: { w: 1160, h: 420, ancho: 150, right: -34, bottom: -20 },
};

/** Debajo de este lado (px) se deja sólo el degradé y la inicial. */
export const LADO_MINIMO_NUBE = 36;

export default function SinFoto({
  nombre,
  id,
  tamano,
  className = "",
}: {
  /** De acá sale la inicial. Vacío (cargando): sin letra, sólo el cielo. */
  nombre?: string | null;
  /** Elige la variante de la nube; si falta, el nombre. */
  id?: string | null;
  tamano?: number;
  className?: string;
}) {
  const inicial = (nombre ?? "").trim().charAt(0).toUpperCase();
  const variante = variantePorId(id || nombre || "");
  const n = NUBE[variante];
  const conNube = tamano === undefined || tamano >= LADO_MINIMO_NUBE;
  return (
    <span
      aria-hidden
      data-sin-foto={conNube ? "nube" : "liso"}
      data-variante={variante}
      className={`sin-foto portada-cielo relative block h-full w-full overflow-hidden ${className}`}
    >
      {conNube && (
        // eslint-disable-next-line @next/next/no-img-element -- decorativa, ya viene en WebP del tamaño justo
        <img
          src={`/cielo/nube-${variante}.webp`}
          alt=""
          width={n.w}
          height={n.h}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="portada-nube"
          style={{ width: `${n.ancho}%`, right: `${n.right}%`, bottom: `${n.bottom}%` }}
        />
      )}
      <span className="sin-foto-inicial portada-tinta absolute inset-0 flex items-center justify-center font-extrabold">
        {inicial}
      </span>
    </span>
  );
}
