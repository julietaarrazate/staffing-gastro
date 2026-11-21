import Link from "next/link";

/**
 * Lista y mapa son la misma tarea (¿qué turno tomo?) vista de dos maneras: un
 * conmutador de vidrio sobre el cielo de Buscar y del Mapa (Julieta,
 * 2026-11-20; maquetas `T-Buscar` y `T-Mapa`). Reemplaza a la pestaña «Mapa»
 * de la barra: las dos pantallas viven bajo «Buscar».
 *
 * Son dos pantallas con su dirección (`/buscar` y `/map`), no un estado: el
 * link de un aviso o un «atrás» llevan a la que corresponde. `replace`, como
 * las pestañas de la barra: ir y volver entre lista y mapa no apila historial.
 */
export default function ListaMapa({ actual, className = "" }: { actual: "lista" | "mapa"; className?: string }) {
  return (
    <nav aria-label="Cómo ver los turnos" className={`conmutador ${className}`}>
      <Link href="/buscar" replace aria-current={actual === "lista" ? "page" : undefined}>
        Lista
      </Link>
      <Link href="/map" replace aria-current={actual === "mapa" ? "page" : undefined}>
        Mapa
      </Link>
    </nav>
  );
}
