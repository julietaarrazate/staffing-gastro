"use client";

import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ui";
import { AlertTriangleIcon } from "@/components/icons";
import { isInactivePlanMessage } from "@/lib/subscription";

/**
 * Se muestra cuando publicar un turno devuelve 402 en vez de un error crudo:
 * por límite de plan (ADR-0005) o, con el cobro prendido, por plan sin pagar
 * (ADR-0021). Explica el motivo y lleva a "Mi plan".
 */
export default function PlanLimitModal({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const inactive = isInactivePlanMessage(message);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={inactive ? "Activá tu plan para publicar" : "Llegaste al límite de tu plan"}
    >
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 text-sm text-ink/60">
          <AlertTriangleIcon size={18} className="mt-0.5 shrink-0 text-danger-text" />
          {message ?? "Alcanzaste el límite de turnos de tu plan actual."}
        </p>
        <div className="flex flex-col gap-2">
          <Button fullWidth onClick={() => router.push("/subscription")}>
            {inactive ? "Ir a pagar el mes" : "Mejorá tu plan"}
          </Button>
          <Button fullWidth variant="surface" onClick={onClose}>
            Ahora no
          </Button>
        </div>
      </div>
    </Modal>
  );
}
