import type { SVGProps } from "react";

/**
 * Íconos propios de la landing (2026-11-16). Sólo los que INFORMAN: los que
 * imitan lo que la persona ve en su teléfono (compartir de iOS, agregar, tres
 * puntos), el pin de ubicación y la estrella de calificación. Los decorativos
 * se sacaron. Geometría recta como el filete: trazo 2, remates cuadrados,
 * uniones en ángulo, `currentColor`. La app sigue con Lucide
 * (`components/icons.tsx`); esto es sólo para la landing.
 *
 * Como los de la app: sin `aria-label` quedan ocultos a lectores de pantalla;
 * con `aria-label` (o `aria-hidden={false}`) se anuncian como imagen.
 */
type Props = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & { size?: number; filled?: boolean };

function Base({ size = 20, filled, children, ...props }: Props & { children: React.ReactNode }) {
  const etiquetado = props["aria-label"] != null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={etiquetado ? "img" : undefined}
      aria-hidden={etiquetado ? undefined : true}
      {...props}
    >
      {children}
    </svg>
  );
}

/** Compartir de iOS: caja abierta con una flecha que sube. */
export function IosShareIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M8 10H5V21H19V10H16" />
      <path d="M12 15V3M8 7L12 3L16 7" />
    </Base>
  );
}

/** Agregar a inicio: cuadrado con un más. */
export function SquarePlusIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M4 4H20V20H4Z" />
      <path d="M12 8V16M8 12H16" />
    </Base>
  );
}

/** Los tres puntos del menú de Chrome. */
export function MoreVerticalIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 4V6M12 11V13M12 18V20" />
    </Base>
  );
}

/** Pin de ubicación: escudo con punta hacia abajo y un cuadrado adentro. */
export function MapPinIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 22L4 11V3H20V11Z" />
      <path d="M10 7H14V11H10Z" />
    </Base>
  );
}

/** Estrella de calificación, de puntas rectas. Con `filled`, llena. */
export function StarIcon(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 2.1L14.7 8.9L22 9.4L16.4 14L18.2 21.1L12 17.2L5.8 21.1L7.6 14L2 9.4L9.3 8.9Z" />
    </Base>
  );
}
