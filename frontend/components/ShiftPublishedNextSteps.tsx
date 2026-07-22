"use client";

import { Modal, Button } from "@/components/ui";
import { SparklesIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

// "Esto es lo que sigue" tras publicar un turno (inspiración de UX: Clickie
// muestra, apenas se genera un pedido, una pantalla clara de qué sigue en el
// ciclo — trasladamos esa claridad acá con la marca naranja de Staffya).
// Reemplaza el cartel de una línea del launch-gate (#88, "Ya estás buscando
// personal..."): esa versión sólo se mostraba UNA vez en la vida de la
// cuenta (localStorage). Esta es más rica (los 4 pasos concretos que
// siguen) y es puramente informativa, no una interrupción molesta — la
// decisión de este PR es mostrarla SIEMPRE que se publica un turno, no sólo
// la primera vez (ver docs/PULIDO_ROADMAP.md / reporte del PR: el criterio
// "una sola vez" tiene sentido para un nudge de producto que puede cansar,
// pero acá cada turno publicado es información nueva y relevante — un
// comercio que publica su turno #12 se beneficia igual de saber qué sigue).
const NEXT_STEPS: { title: string; detail: string; tag?: string }[] = [
  {
    title: "Recibís candidatos",
    tag: "ahora",
    detail: "Los mejores trabajadores disponibles cerca tuyo ya pueden postularse.",
  },
  {
    title: "Elegís al mejor",
    detail: "Comparás reputación y cercanía de cada postulante antes de asignar.",
  },
  {
    title: "Trabaja el turno",
    detail: "El trabajador confirma, llega y marca check-in/check-out el día pactado.",
  },
  {
    title: "Se califican",
    detail: "Vos y el trabajador se califican mutuamente al cerrar el turno.",
  },
];

export default function ShiftPublishedNextSteps({
  open,
  onClose,
  onViewShift,
}: {
  open: boolean;
  onClose: () => void;
  onViewShift: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-primary">
          <SparklesIcon size={26} />
        </span>
        <h3 className="mt-3 text-xl font-extrabold tracking-tight text-ink">¡Turno publicado!</h3>
        <p className="mt-1 text-sm text-ink/60">Ya estamos buscando personal para vos.</p>
      </div>

      <ol className="mt-5 flex flex-col">
        {NEXT_STEPS.map((item, i) => (
          <li key={item.title} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  i === 0 ? "bg-primary text-white" : "bg-orange-50 text-primary"
                )}
              >
                {i + 1}
              </span>
              {i < NEXT_STEPS.length - 1 && <span className="my-0.5 w-0.5 flex-1 bg-line" />}
            </div>
            <div className={cn("min-w-0 flex-1 pb-4 pt-0.5 text-left", i === NEXT_STEPS.length - 1 && "pb-1")}>
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink">
                {item.title}
                {item.tag && (
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    {item.tag}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink/55">{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-2 flex flex-col gap-2">
        <Button fullWidth onClick={onViewShift}>
          Ver mi turno
        </Button>
        <Button fullWidth variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Modal>
  );
}
