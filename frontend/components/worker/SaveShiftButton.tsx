"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { setShiftSaved, useIsShiftSaved } from "@/lib/saved-shifts";
import { useToast } from "@/components/ui";
import { BookmarkIcon } from "@/components/icons";

/**
 * Botón "Guardar" (trabajador → turno): bookmark privado para evaluar un
 * turno después sin postularse todavía (pedido de Julieta: "así comienza
 * algo más de evaluar opciones que convengan"). Sin efecto sobre matching
 * ni postulación — mismo criterio que `FavoriteToggle` (comercio →
 * trabajador, en `app/workers/[id]/page.tsx`), mismo patrón optimista.
 *
 * Pensado como overlay circular sobre una foto (`OpportunityCard`): sólo
 * ícono, sin texto — `onPointerDown` con `stopPropagation` para no arrancar
 * el drag del mazo (`SwipeDeck`) al tocarlo, mismo criterio que "Cómo
 * llegar"/"Compartir por WhatsApp" en esa misma card.
 */
export default function SaveShiftButton({
  shiftId,
  className = "",
}: {
  shiftId: string;
  className?: string;
}) {
  const { token } = useAuth();
  const toast = useToast();
  // Un solo pedido para todas las tarjetas (`lib/saved-shifts.ts`).
  const isSaved = useIsShiftSaved(shiftId, token);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!token || isSaved === null || busy) return;
    setBusy(true);
    const next = !isSaved;
    setShiftSaved(shiftId, next); // optimista
    try {
      if (next) {
        await api.put<{ is_saved: boolean }>(`/saved-shifts/${shiftId}`, undefined, token);
      } else {
        await api.del<{ is_saved: boolean }>(`/saved-shifts/${shiftId}`, undefined, token);
      }
    } catch (err) {
      setShiftSaved(shiftId, !next); // revertir si falló
      // AVISAR, no sólo revertir (Julieta, 2026-08-17: "cuando aprieto el
      // botón de guardar no guarda"). Antes el `catch` revertía en
      // silencio: el ícono se llenaba por el optimismo y volvía atrás sin
      // decir nada, así que desde afuera se ve idéntico a un botón roto.
      // Misma clase de falla silenciosa que el `.catch(() => {})` de la
      // geolocalización, ya corregido.
      toast(next ? "No pudimos guardar el turno" : "No pudimos quitarlo de guardados", "error");
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setBusy(false);
    }
  }

  if (isSaved === null) return null;

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      disabled={busy}
      aria-label={isSaved ? "Quitar de guardados" : "Guardar para después"}
      aria-pressed={isSaved}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card shadow-sm transition active:scale-90 disabled:opacity-60 ${
        isSaved ? "text-primary" : "text-ink/60"
      } ${className}`}
    >
      <BookmarkIcon size={16} filled={isSaved} />
    </button>
  );
}
