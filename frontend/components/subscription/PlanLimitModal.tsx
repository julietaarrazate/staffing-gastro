"use client";

import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ui";
import { AlertTriangleIcon } from "@/components/icons";

/**
 * Se muestra cuando publicar un turno devuelve 402/403 por límite de plan
 * (ADR-0005, Fase 1) en vez de un error crudo: explica el motivo y ofrece el
 * camino directo a mejorar el plan.
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

  return (
    <Modal open={open} onClose={onClose} title="Llegaste al límite de tu plan">
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 text-sm text-ink/60">
          <AlertTriangleIcon size={18} className="mt-0.5 shrink-0 text-danger" />
          {message ?? "Alcanzaste el límite de turnos de tu plan actual."}
        </p>
        <div className="flex flex-col gap-2">
          <Button fullWidth onClick={() => router.push("/subscription")}>
            Mejorá tu plan
          </Button>
          <Button fullWidth variant="surface" onClick={onClose}>
            Ahora no
          </Button>
        </div>
      </div>
    </Modal>
  );
}
