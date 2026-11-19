"use client";

// «Cerrar turno» de la admin (decisión 21, ADR-0024): en la ficha de una
// cuenta suspendida, marca la salida y/o cierra un turno empezado en nombre
// de la parte que ya no puede entrar. Antes de confirmar dice exactamente qué
// va a pasar (a qué hora se marca la salida, si se cierra, a quién se
// avisa); al terminar, qué se hizo. Qué aplica lo decide el backend
// (`admin_close` de cada turno), no esta pantalla.

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { formatShiftTime } from "@/lib/datetime";
import type { TapGuard } from "@/lib/use-tap-guard";
import type { AdminCloseAction, AdminShiftClosure } from "@/lib/types";
import { Button, Modal } from "@/components/ui";
import { adminCloseLines, adminCloseResult } from "@/components/admin/people";

export interface CerrarTurnoTarget {
  id: string;
  /** Título del turno (o el puesto), para el encabezado del diálogo. */
  name: string;
  action: AdminCloseAction;
}

/**
 * Montalo con `key={target.id}`: la hora que promete («a las 21:40») se toma
 * al abrir, y cada turno empieza sin resultado ni error.
 */
export default function CerrarTurnoDialog({
  target,
  token,
  tapGuard,
  onClose,
  onChanged,
}: {
  target: CerrarTurnoTarget;
  token: string;
  /** La guarda de la pantalla: el doble toque que abrió el diálogo no confirma. */
  tapGuard: TapGuard;
  onClose: () => void;
  /** El turno cambió (se cerró, o el backend respondió 409): la ficha se
   * vuelve a cargar mientras el diálogo muestra el resultado o el motivo. */
  onChanged: () => void;
}) {
  const [hora] = useState(() => formatShiftTime(new Date().toISOString()));
  const [result, setResult] = useState<AdminShiftClosure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function confirm() {
    void tapGuard.run(async () => {
      setSending(true);
      setError(null);
      try {
        // Lo que la admin vio y confirma: si ahora se haría otra cosa, el
        // backend no hace nada y responde 409.
        const closed = await api.post<AdminShiftClosure>(
          `/admin/shifts/${target.id}/close`,
          { check_out: target.action.check_out, finish: target.action.finish },
          token
        );
        setResult(closed);
        onChanged();
      } catch (err) {
        setError(getErrorMessage(err, "No se pudo cerrar el turno"));
        // 409: el turno o una cuenta cambió; la ficha muestra cómo quedó.
        if (err instanceof ApiError && err.status === 409) onChanged();
      } finally {
        setSending(false);
      }
    });
  }

  if (result) {
    const horaSalida = result.checked_out_at ? formatShiftTime(result.checked_out_at) : null;
    return (
      <Modal open onClose={onClose} title="Listo">
        <p className="text-sm text-ink" aria-live="polite">
          {adminCloseResult(result, horaSalida)}
        </p>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={onClose}>
            Entendido
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`¿Cerrar «${target.name}»?`}>
      <ul className="flex flex-col gap-1.5 text-sm text-ink">
        {adminCloseLines(target.action, hora).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-tint px-3.5 py-2.5 text-sm font-medium text-danger-text ring-1 ring-danger/15">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="surface" size="sm" onClick={onClose}>
          Volver
        </Button>
        {/* La acción principal de la app (ámbar), como «Sí, ya le pagué»:
            `dark` daba 1,1:1 contra el diálogo en oscuro. */}
        <Button
          size="sm"
          disabled={tapGuard.locked && !sending}
          loading={sending}
          onClick={confirm}
        >
          Sí, cerrar turno
        </Button>
      </div>
    </Modal>
  );
}
