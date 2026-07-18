"use client";

import { Button } from "@/components/ui";
import { ShareIcon } from "@/components/icons";
import { ShareableShift, shareShift } from "@/lib/shift-share";

export default function ShareShiftButton({
  shift,
  shiftId,
}: {
  shift: ShareableShift;
  shiftId: string;
}) {
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
