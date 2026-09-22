"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Shift } from "@/lib/types";
import SwipeDeck from "@/components/worker/SwipeDeck";
import { CloseIcon } from "@/components/icons";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * "Descubrir rápido": el mazo tipo Tinder, ahora como modo a pantalla completa
 * detrás de un botón del home (decisión de Julieta, 2026-09-22 — el home pasó a
 * la composición del board y el swipe se conserva para quien quiere decidir en
 * segundos).
 *
 * Se porta a `document.body`: un `position: fixed` dentro de un ancestro con
 * transform deja de ser relativo al viewport (el bug de Sheet/Modal, ver
 * docs/BUGS.md).
 */
export default function DiscoverDeck({
  shifts,
  onDecide,
  onOpen,
  onClose,
  renderCard,
  empty,
}: {
  shifts: Shift[];
  onDecide: (shift: Shift, decision: "like" | "pass") => Promise<boolean>;
  onOpen: (shift: Shift) => void;
  onClose: () => void;
  renderCard: (shift: Shift) => ReactNode;
  empty: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Mismo trap que Modal/Sheet: mueve el foco adentro (al botón de cerrar, el
  // primer focuseable), no deja tabular hacia el home tapado y lo devuelve al
  // botón "Descubrir rápido" al cerrar.
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      ref={dialogRef}
      aria-labelledby="discover-title"
      className="fixed inset-0 z-50 flex flex-col bg-background safe-top"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <div>
          <h2 id="discover-title" className="font-display text-h2 font-medium text-ink">
            Descubrir rápido
          </h2>
          <p className="text-xs text-ink/55">Deslizá a la derecha para postularte, a la izquierda para pasar.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink ring-1 ring-line"
        >
          <CloseIcon size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SwipeDeck shifts={shifts} onDecide={onDecide} onOpen={onOpen} renderCard={renderCard} empty={empty} />
      </div>
    </div>,
    document.body
  );
}
