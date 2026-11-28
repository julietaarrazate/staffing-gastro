"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { cuandoPuedeAvisar, estadoCobro } from "@/lib/cobro";
import { useIdempotencyKeys } from "@/lib/idempotency";
import type { Shift } from "@/lib/types";
import { Button } from "@/components/ui";
import { CheckIcon } from "@/components/icons";

type Accion = "payment-received" | "payment-missing";

/**
 * «¿Ya cobraste este turno?» — la persona dice si cobró (2026-11-27).
 *
 * Oído no mueve plata: el comercio le paga por fuera, así que acá sólo se
 * registra lo que dice la persona. «Sí, cobré» es definitivo; «Todavía no» se
 * puede una vez (con las reglas de plazo del servidor) y abre un ticket de
 * soporte. Bajo «Ver como» el servidor contesta 403 (`impersonation_read_only`)
 * y el motivo se muestra acá, igual que en las otras acciones.
 */
export default function CobroDeLaPersona({
  shift,
  now,
  onChanged,
}: {
  shift: Shift;
  now: Date;
  /** Recarga la lista: el turno ya trae lo que quedó registrado. */
  onChanged: () => void | Promise<void>;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = useState<Accion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { keyFor, clearSiTermino, clear } = useIdempotencyKeys();
  const estado = estadoCobro(shift, now);

  async function decir(accion: Accion) {
    if (!token || busy) return;
    const key = `${shift.id}:${accion}`;
    setBusy(accion);
    setError(null);
    try {
      await api.post(`/shifts/${shift.id}/${accion}`, undefined, token, undefined, keyFor(key));
      clear(key);
      await onChanged();
    } catch (err) {
      clearSiTermino(key, err);
      setError(getErrorMessage(err, "No pudimos registrarlo. Probá de nuevo."));
      // El turno pudo cambiar (ya lo había dicho desde otro aparato).
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  if (estado.fase === "confirmado") {
    return (
      <p
        data-testid="cobro-confirmado"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-text"
      >
        <CheckIcon size={16} /> Confirmaste el cobro
      </p>
    );
  }

  const botonSi = (
    <Button
      size="sm"
      variant="surface"
      className="boton-hondo"
      loading={busy === "payment-received"}
      disabled={busy !== null}
      onClick={() => void decir("payment-received")}
    >
      Sí, cobré
    </Button>
  );

  if (estado.fase === "avisado") {
    return (
      <div data-testid="cobro-avisado" className="caja-resena rounded-xl bg-surface px-3 py-2.5">
        <p className="text-sm font-semibold text-ink">Avisaste que no cobraste: soporte ya lo sabe</p>
        <p className="mt-1 text-xs text-ink-soft">Si ya te pagaron, confirmalo acá.</p>
        {error && (
          <p role="alert" className="mt-1 text-sm text-danger-text">
            {error}
          </p>
        )}
        <div className="mt-2">{botonSi}</div>
      </div>
    );
  }

  return (
    <div data-testid="cobro-pregunta" className="caja-resena rounded-xl bg-surface px-3 py-3">
      <p className="text-xs font-semibold text-ink-soft">¿Ya cobraste este turno?</p>
      {estado.comercioMarcoPagado && (
        <p className="mt-1 text-xs text-ink-soft">El comercio marcó este turno como pagado.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {botonSi}
        <Button
          size="sm"
          variant="surface"
          loading={busy === "payment-missing"}
          disabled={busy !== null || !estado.puedeAvisar}
          onClick={() => void decir("payment-missing")}
        >
          Todavía no
        </Button>
      </div>
      {!estado.puedeAvisar && estado.avisarDesde && (
        <p className="mt-2 text-xs text-ink-soft">
          Podés avisar que todavía no cobraste {cuandoPuedeAvisar(estado.avisarDesde)}. Hasta entonces, coordiná el pago
          con el comercio por el chat.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
