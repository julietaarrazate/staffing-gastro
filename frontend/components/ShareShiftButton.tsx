"use client";

import { Button } from "@/components/ui";
import { ShareIcon } from "@/components/icons";
import { isShareable, ShareableShift, shareShift } from "@/lib/shift-share";

export default function ShareShiftButton({
  shift,
  shiftId,
}: {
  shift: ShareableShift;
  shiftId: string;
}) {
  // Un turno que ya no está abierto (asignado, en curso, cerrado) no tiene
  // vista pública: el link abriría en "Turno no encontrado". Se decide acá,
  // y no en cada pantalla, para que ninguna lo muestre de más.
  if (!isShareable(shift)) return null;

  function handleShare() {
    const publicUrl = `${window.location.origin}/turno/${shiftId}`;
    shareShift(shift, publicUrl);
  }

  return (
    <Button size="sm" variant="secondary" leftIcon={<ShareIcon size={16} />} onClick={handleShare}>
      Compartir por WhatsApp
    </Button>
  );
}
