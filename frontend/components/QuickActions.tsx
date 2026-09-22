import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Fila de acciones rápidas: **una primaria y el resto pares**.
 *
 * Idea tomada de una referencia de logística que pasó Julieta (2026-09-16).
 * Lo que se tomó de ahí es la GRAMÁTICA, no la pantalla: cuatro destinos
 * equivalentes en tamaño, con el acento marcando cuál es el que importa. Es la
 * misma regla que ya usamos en la tarjeta del candidato recomendado — el color
 * señala lo singular, y para eso el resto tiene que estar callado.
 *
 * Reemplaza a los dos botones que vivían apretados contra el título del panel
 * ("+ Evento" outline y "+ Publicar" lleno). Ese arreglo tenía dos problemas:
 * no escalaba (no había dónde poner una tercera acción) y dejaba enterradas a
 * dos pantallas útiles —Favoritos y Mi plan— a dos toques de distancia, dentro
 * del menú de Perfil.
 *
 * POR QUÉ LAS TRES SECUNDARIAS VAN NEUTRAS y no con el juego de acentos
 * manteca/celeste: ese juego es para DATOS, donde cada color distingue un tipo
 * de dato (turnos vs. horas vs. fiabilidad). Acá son ACCIONES, y entre ellas la
 * única diferencia que importa es jerárquica. Pintarlas de colores distintos
 * diría que son de clases distintas, que es falso.
 *
 * Neutro, eso sí, NO como ausencia de color: el chip usa `bg-card` + `ring-line`,
 * que son superficies del sistema y por lo tanto suben un escalón en modo
 * oscuro (ver la escala de elevación en COLOR_SYSTEM.md). Un `bg-transparent`
 * acá se moriría sobre el lienzo oscuro, que es exactamente el defecto que
 * Julieta cazó en el chip de "Cancelaciones".
 */
export interface QuickAction {
  href: string;
  label: string;
  icon: ReactNode;
  /** La única acción con acento. Como mucho una por fila. */
  primary?: boolean;
  /** Para el tour guiado / tests. */
  tourId?: string;
}

export default function QuickActions({
  actions,
  className,
}: {
  actions: QuickAction[];
  className?: string;
}) {
  return (
    <nav aria-label="Acciones rápidas" className={className}>
      <ul className="grid grid-cols-4 gap-2.5">
        {actions.map((action) => (
          <li key={action.href}>
            <Link
              href={action.href}
              data-tour={action.tourId}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              {/* El cuadrado del ícono es el control visual; la etiqueta va
                  afuera para que el texto no lo apriete. Mismo lado (56px) en
                  las cuatro, así la fila lee como una unidad y no como cuatro
                  botones sueltos de tamaños parecidos. */}
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-[var(--radius-input)] transition active:scale-95 ${
                  action.primary
                    ? "bg-primary text-night shadow-[var(--shadow-primary-sm)]"
                    : "bg-card text-ink/70 ring-1 ring-line"
                }`}
              >
                {action.icon}
              </span>
              <span
                className={`text-xs leading-tight ${
                  action.primary ? "font-bold text-ink" : "font-semibold text-ink/65"
                }`}
              >
                {action.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
