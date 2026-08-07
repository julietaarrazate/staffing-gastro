"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Sheet } from "@/components/ui";
import ShareShiftButton from "@/components/ShareShiftButton";
import { AlertTriangleIcon, CheckCircleIcon, CopyIcon, MessageIcon } from "@/components/icons";
import { nextStepFor, type PrimaryAction } from "@/lib/shift-next-step";
import type { Shift } from "@/lib/types";

/**
 * Acciones de un turno en el panel del comercio.
 *
 * Antes cada tarjeta apilaba hasta 7 botones al mismo nivel y el comercio
 * tenía que deducir cuál correspondía a esta altura del ciclo. Acá se muestra
 * en qué anda el turno + LA acción que le toca al comercio ahora (si le toca
 * alguna), y todo lo demás queda detrás de "Más".
 */

// Sólo tiene sentido marcar no-show mientras el trabajador confirmado
// todavía no se presentó (antes del check-in) — ADR-0007.
const NO_SHOW_ELIGIBLE = ["confirmado", "en_camino"];
const CANCELLABLE_EXCLUDED = ["finalizado", "pagado", "cancelado"];

export default function ShiftActions({
  shift,
  busy,
  onRun,
  onNoShow,
  onCancel,
}: {
  shift: Shift;
  busy: string | null;
  /** `candidates` no pasa por acá: es un Link, no una mutación. */
  onRun: (id: string, action: Exclude<PrimaryAction, "candidates"> | "cancel") => void;
  onNoShow: () => void;
  onCancel: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const step = nextStepFor(shift);

  const canCancel = !CANCELLABLE_EXCLUDED.includes(shift.status);
  const canNoShow = NO_SHOW_ELIGIBLE.includes(shift.status);
  const hasWorker = Boolean(shift.worker_profile_id) && shift.status !== "cancelado";

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-ink/60">
        {shift.status === "pagado" && (
          <CheckCircleIcon size={15} className="mr-1 inline-block align-[-2px] text-success-text" />
        )}
        {step.hint}
      </p>

      <div className="flex items-center gap-2">
        {step.action === "candidates" ? (
          <Link
            href={`/shifts/${shift.id}/candidates`}
            className="flex-1 rounded-full bg-primary px-4 py-2 text-center text-sm font-semibold text-ink transition active:scale-95"
          >
            {step.actionLabel}
          </Link>
        ) : step.action ? (
          <Button
            size="sm"
            fullWidth
            onClick={() =>
              onRun(shift.id, step.action as Exclude<PrimaryAction, "candidates">)
            }
            loading={busy === `${shift.id}:${step.action}`}
            disabled={busy !== null}
          >
            {step.actionLabel}
          </Button>
        ) : null}

        {hasWorker && (
          <Link
            href={`/chats/${shift.id}`}
            aria-label="Abrir chat con el trabajador"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-sm font-semibold text-ink/70 ring-1 ring-line transition active:scale-95"
          >
            <MessageIcon size={16} /> Chat
          </Link>
        )}

        <button
          type="button"
          aria-label="Más acciones"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="shrink-0 rounded-full bg-surface px-3 py-2 text-sm font-semibold text-ink/70 ring-1 ring-line transition active:scale-95"
        >
          Más
        </button>
      </div>

      {/* Antes era un dropdown `position: absolute` anclado al botón "Más":
          en mobile terminaba con la esquina fuera de la pantalla (recortado,
          casi ilegible) y en desktop se abría como una ventanita rara —
          dependía de cuánto lugar quedaba a la derecha del botón, que varía
          con el layout de cada tarjeta (bug real con captura, Julieta
          2026-07-31). `Sheet` es `position: fixed` a toda la pantalla — nunca
          se puede recortar ni desalinear, y es el mismo patrón que ya usan
          `/map` y `/shifts/new` para acciones desde una tarjeta. */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Más acciones">
        <div className="flex flex-col divide-y divide-line pb-2">
          {hasWorker && (
            <MenuLink href={`/workers/${shift.worker_profile_id}`}>
              Ver perfil del trabajador
            </MenuLink>
          )}
          {shift.status === "publicado" && (
            <div className="py-2.5">
              <ShareShiftButton shift={shift} shiftId={shift.id} />
            </div>
          )}
          <MenuLink href={`/shifts/new?duplicate=${shift.id}`}>
            <CopyIcon size={15} /> Duplicar turno
          </MenuLink>
          {canNoShow && (
            <MenuButton
              onClick={() => {
                setMenuOpen(false);
                onNoShow();
              }}
            >
              <AlertTriangleIcon size={15} /> No se presentó
            </MenuButton>
          )}
          {canCancel && (
            <MenuButton
              danger
              disabled={busy !== null}
              onClick={() => {
                setMenuOpen(false);
                onCancel();
              }}
            >
              Cancelar turno
            </MenuButton>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-ink/80 hover:bg-surface"
    >
      {children}
    </Link>
  );
}

function MenuButton({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium hover:bg-surface disabled:opacity-50 ${
        danger ? "text-danger-text" : "text-ink/80"
      }`}
    >
      {children}
    </button>
  );
}
