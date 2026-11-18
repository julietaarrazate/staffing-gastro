import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * La comanda: el turno como papel de cocina, con el relieve del filete
 * (dirección «con relieve», ADR-0027; docs/design-system/direccion-relieve.md).
 * Es EL objeto con relieve de la pantalla: una por pantalla, la que importa.
 *
 * El papel es papel en los dos temas: adentro va forzado a claro
 * (`data-theme="light"`), así la tinta, los filetes y lo que se monte encima
 * (un sello, el botón de guardar) se ven igual de día y de noche. En oscuro
 * el papel baja un punto (`--comanda-papel`) para no encandilar, y el relieve
 * sigue al tema porque lo pinta el contenedor de afuera.
 */
export function Comanda({
  as: Tag = "div",
  className,
  children,
  ...rest
}: { as?: "div" | "article" | "section" | "li" } & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("comanda", className)} {...rest}>
      <div data-theme="light" className="comanda-papel">
        {children}
      </div>
    </Tag>
  );
}

/** Un renglón de la comanda: el rótulo a la izquierda y el dato a la derecha,
 *  con filete fino arriba. Van dentro de un `<dl>`. */
export function ComandaFila({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="comanda-fila">
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Un texto para ir en brocha (`.letra-cartel`). La barra de «Mozo/a» o
 * «Cocinero/a», dibujada con la brocha, se lee como una letra más («MOZOIA»):
 * se separa para ir en la letra de texto, fina.
 */
export function textoCartel(texto: string): ReactNode {
  const partes = texto.split("/");
  if (partes.length === 1) return texto;
  return partes.flatMap((parte, i) =>
    i === 0
      ? [parte]
      : [
          <span key={`b${i}`} className="barra">
            /
          </span>,
          parte,
        ]
  );
}

/** Un apunte a mano, rodeado con un óvalo: uno por pantalla, corto. */
export function Apunte({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("letra-mano apunte", className)}>
      {children}
      <svg aria-hidden viewBox="0 0 100 60" preserveAspectRatio="none">
        <path d="M52 5C80 3 97 14 96 31C95 49 72 57 46 56C19 55 3 45 4 28C5 11 28 4 60 7" />
      </svg>
    </span>
  );
}
