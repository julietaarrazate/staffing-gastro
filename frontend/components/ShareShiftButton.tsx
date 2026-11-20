"use client";

import { Button } from "@/components/ui";
import { ShareIcon } from "@/components/icons";
import { ShareableShift, shareShift } from "@/lib/shift-share";

export default function ShareShiftButton({
  shift,
  shiftId,
  vidrio = false,
}: {
  shift: ShareableShift;
  shiftId: string;
  /** Sólo el ícono, en un botón redondo de vidrio: para ir sobre la foto o el
   *  cielo del detalle del turno (ADR-0028). */
  vidrio?: boolean;
}) {
  function handleShare() {
    const publicUrl = `${window.location.origin}/turno/${shiftId}`;
    shareShift(shift, publicUrl);
  }

  if (vidrio) {
    return (
      <button
        type="button"
        onClick={handleShare}
        aria-label="Compartir"
        className="boton-vidrio sobre-foto h-11 w-11 shrink-0"
      >
        <ShareIcon size={20} />
      </button>
    );
  }

  return (
    <Button size="sm" variant="secondary" leftIcon={<ShareIcon size={16} />} onClick={handleShare}>
      Compartir por WhatsApp
    </Button>
  );
}
