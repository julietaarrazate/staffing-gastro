"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button, Modal } from "@/components/ui";
import { formatShiftStartPhrase } from "@/lib/datetime";
import type { Shift } from "@/lib/types";

/**
 * Carril urgente (ADR-0032, Julieta 2026-11-27): en un turno que empieza en
 * menos de 6 horas, postularse es un compromiso. Cuando `shift.apply_commits`
 * es true, el botón dice «Puedo ir ya» y, antes de postular, se le pregunta a
 * la persona. Es la única definición del texto y de la pregunta: todas las
 * pantallas que postulan pasan por acá.
 */

/** Lo único que estos textos miran del turno (opcional: el detalle arma el
 *  turno con la vista pública, que no lo trae). */
type ConCompromiso = { apply_commits?: boolean };
type ConTurno = ConCompromiso & Pick<Shift, "start_at">;

/** Lo que dice el botón que postula, según el turno. */
export function textoPostularse(shift: ConCompromiso): string {
  return shift.apply_commits ? "Puedo ir ya" : "Postularme";
}

/** El aviso al terminar de postularse. */
export function avisoPostulacion(shift: ConCompromiso): string {
  return shift.apply_commits
    ? "¡Te ofreciste! Si el comercio te acepta, el turno queda confirmado"
    : "¡Te postulaste! El comercio ya te puede ver";
}

/** Dónde la persona ve que ya se postuló (título y renglón de abajo).
 *  `ofrecido` es `se_ofrecio_para_ya` de SU postulación (o que acaba de
 *  confirmar la pregunta), no `apply_commits` del turno al mirar: quien se
 *  postuló con tiempo no recibió esa promesa. */
export function estadoPostulado(ofrecido: boolean): { titulo: string; detalle: string } {
  return ofrecido
    ? { titulo: "Te ofreciste para este turno.", detalle: "Si te aceptan, queda confirmado." }
    : { titulo: "Ya te postulaste", detalle: "Te avisamos cuando el comercio responda." };
}

export function ConfirmarPuedoIr({
  shift,
  open,
  onConfirm,
  onCancel,
}: {
  shift: Pick<Shift, "start_at"> | null;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title="¿Podés ir a este turno?">
      <p className="text-sm text-ink-soft" data-testid="confirmar-puedo-ir">
        {shift ? `Empieza ${formatShiftStartPhrase(shift.start_at)}. ` : ""}
        Si el comercio te acepta, el turno queda confirmado en el momento: no vas a tener que confirmar de nuevo. Si
        después no podés ir, cuenta como una cancelación.
      </p>
      <div className="mt-4 flex flex-col-reverse gap-2 min-[380px]:flex-row min-[380px]:justify-end">
        <Button variant="surface" size="sm" onClick={onCancel}>
          Ahora no
        </Button>
        <Button size="sm" onClick={onConfirm}>
          Sí, puedo ir
        </Button>
      </div>
    </Modal>
  );
}

/**
 * `confirmar(shift)` resuelve `true` enseguida si postularse no compromete, y
 * si compromete abre la pregunta y resuelve según lo que toque la persona.
 * `dialogo` va una sola vez en el árbol de la pantalla.
 */
export function useConfirmarPuedoIr(): {
  confirmar: (shift: ConTurno) => Promise<boolean>;
  dialogo: ReactNode;
} {
  const [abierto, setAbierto] = useState(false);
  // El turno queda mientras el diálogo se cierra animado.
  const [turno, setTurno] = useState<ConTurno | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const responder = useCallback((ok: boolean) => {
    setAbierto(false);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const confirmar = useCallback(
    (shift: ConTurno) => {
      if (!shift.apply_commits) return Promise.resolve(true);
      // Un segundo pedido antes de contestar el primero cuenta como «ahora no».
      resolver.current?.(false);
      setTurno(shift);
      setAbierto(true);
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
    },
    []
  );

  const dialogo = (
    <ConfirmarPuedoIr
      shift={turno}
      open={abierto}
      onConfirm={() => responder(true)}
      onCancel={() => responder(false)}
    />
  );
  return { confirmar, dialogo };
}
