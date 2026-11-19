import type { ComponentType } from "react";
import type { IconProps } from "@/components/icons";

/**
 * La portada de un turno sin foto: el cielo (ADR-0028). Reemplaza al bloque
 * de color plano por rubro (`SKILL_HERO_TONE`) donde la tarjeta lo usa. Es
 * decorativa: no lleva texto, llena su contenedor y el contenedor pone el
 * recorte (`overflow-hidden` y el radio).
 *
 * - De día: el degradé del cielo con su luz y una nube con volumen abajo a
 *   la derecha, cortada por el borde. De noche: el degradé hondo con la nube
 *   al 30 %, para que siga siendo un bloque azul sobre la tarjeta oscura.
 * - El ícono del rubro, en la tinta del cielo (blanco sobre el hondo), dentro
 *   de un círculo de vidrio.
 * - La nube cambia según el turno (tres variantes con un hash estable del
 *   id, no al azar en cada render) para que una lista sin fotos no parezca
 *   clonada.
 * - `mini`: para miniaturas (48 px): el degradé y el ícono solos, sin nube ni
 *   círculo.
 *
 * La letra que va encima (la tarjeta grande) usa `.portada-tinta`, que sigue
 * al cielo: tinta de día, blanco de noche.
 */
export type VariantePortada = "a" | "b" | "c";

const VARIANTES: VariantePortada[] = ["a", "b", "c"];

/** Variante de nube de un turno: siempre la misma para el mismo id. */
export function variantePorId(id: string): VariantePortada {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return VARIANTES[h % VARIANTES.length];
}

/** Tamaño propio de cada imagen y dónde cae: ancho en px y corrimiento. */
const NUBE: Record<VariantePortada, { w: number; h: number; ancho: number; right: number; bottom: number }> = {
  a: { w: 840, h: 500, ancho: 170, right: -40, bottom: -34 },
  b: { w: 680, h: 480, ancho: 140, right: -18, bottom: -38 },
  c: { w: 1160, h: 420, ancho: 270, right: -64, bottom: -26 },
};

/** Dónde va el círculo del ícono: arriba a la derecha (franjas bajas, con los
 *  chips a la izquierda) o al centro a la izquierda (portadas altas). */
type LugarIcono = "arriba-der" | "centro-izq";

/** Dónde cae la nube: cortada por el borde de abajo (franjas bajas) o a media
 *  altura, a la derecha (portadas altas, donde el puesto y el barrio ocupan
 *  el borde de abajo y la nube no puede quedar detrás de ese texto). */
type LugarNube = "abajo" | "medio";

export default function PortadaCielo({
  id,
  Icon,
  mini = false,
  iconoEn = "arriba-der",
  nubeEn = "abajo",
  className = "",
}: {
  /** Id del turno: elige la variante de la nube. */
  id: string;
  Icon: ComponentType<IconProps>;
  mini?: boolean;
  iconoEn?: LugarIcono;
  nubeEn?: LugarNube;
  className?: string;
}) {
  if (mini) {
    return (
      <span
        aria-hidden
        data-portada="mini"
        className={`portada-cielo flex h-full w-full items-center justify-center ${className}`}
      >
        <Icon size={22} />
      </span>
    );
  }
  const variante = variantePorId(id);
  const n = NUBE[variante];
  return (
    <div
      aria-hidden
      data-portada="portada"
      data-variante={variante}
      data-nube={nubeEn}
      className={`portada-cielo absolute inset-0 overflow-hidden ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorativa, ya viene en WebP del tamaño justo */}
      <img
        src={`/cielo/nube-${variante}.webp`}
        alt=""
        width={n.w}
        height={n.h}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="portada-nube"
        style={{ width: n.ancho, right: n.right, bottom: nubeEn === "medio" ? "34%" : n.bottom }}
      />
      <span
        className={`portada-vidrio absolute flex h-11 w-11 items-center justify-center rounded-full ${
          iconoEn === "arriba-der" ? "right-3 top-3" : "left-5 top-1/2 h-14 w-14 -translate-y-1/2"
        }`}
      >
        <Icon size={iconoEn === "arriba-der" ? 22 : 28} />
      </span>
    </div>
  );
}
