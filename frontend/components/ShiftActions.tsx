"use client";

import { puedeMarcarAusencia, puedeMarcarLlegada } from "@/lib/turno-reofrecido";
import { useState } from "react";
import { useNow } from "@/lib/use-now";
import Link from "next/link";
import { Button, Sheet } from "@/components/ui";
import ShareShiftButton from "@/components/ShareShiftButton";
import { AlertTriangleIcon, CheckCircleIcon, CopyIcon, MessageIcon, PencilIcon } from "@/components/icons";
import { isCancellable } from "@/lib/cancelar-turno";
import { autoFinishPhrase, firstNameOf, nextStepFor, type PrimaryAction } from "@/lib/shift-next-step";
import type { Shift } from "@/lib/types";

/**
 * Acciones de un turno en el panel del comercio.
 *
 * Antes cada tarjeta apilaba hasta 7 botones al mismo nivel y el comercio
 * tenía que deducir cuál correspondía a esta altura del ciclo. Acá se muestra
 * en qué anda el turno + LA acción que le toca al comercio ahora (si le toca
 * alguna), y todo lo demás queda detrás de "Más".
 *
 * Esa acción ocupa siempre el mismo lugar y cambia con el estado («Cerrar
 * turno» pasa a ser «Marcar como pagado»). Por eso los botones se apagan con
 * `locked` (la guarda de `lib/use-tap-guard.ts`: una acción en curso o la
 * lista recién redibujada) y no sólo mientras carga el propio.
 *
 * Con la dirección suave (ADR-0028, 2026-11-20) la acción de la fila va en
 * azul hondo (`.boton-hondo`) y «Chat» y «Más», quietos: el único ámbar del
 * panel es el del cielo.
 */

/** «Chat» y «Más»: quietos (relleno del campo, letra azul hondo). */
const QUIETO =
  "boton boton-quieto inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold transition active:scale-95";

// Sólo tiene sentido marcar no-show mientras el trabajador confirmado
// todavía no se presentó (antes del check-in) — ADR-0007.
const NO_SHOW_ELIGIBLE = ["confirmado", "en_camino"];
// ...y recién desde 10 minutos después del inicio (puntualidad real): antes, el trabajador todavía puede llegar. A quien tomó el
// turno ya empezado (U080) se le cuenta desde que confirmó. El servidor
// aplica la misma regla (`Shift.no_show`); `puedeMarcarAusencia` sólo evita
// ofrecer la opción antes.

export default function ShiftActions({
  shift,
  busy,
  locked,
  onRun,
  onMarkPaid,
  onNoShow,
  onCancel,
  onYaLlego,
}: {
  shift: Shift;
  /** Qué botón muestra el indicador de carga (`<id>:<acción>`). */
  busy: string | null;
  /** Hay una acción en curso o la lista se acaba de redibujar (`useTapGuard`):
   *  ningún botón de acción de la tarjeta acepta toques. */
  locked: boolean;
  /** `candidates` no pasa por acá (es un Link, no una mutación) y `markPaid`
   *  tampoco: no se puede deshacer, así que primero pide confirmación. */
  onRun: (id: string, action: Exclude<PrimaryAction, "candidates" | "markPaid"> | "cancel") => void;
  onMarkPaid: () => void;
  onNoShow: () => void;
  onCancel: () => void;
  /** «Ya llegó»: el comercio marca la llegada de quien no la marcó y dice si
   *  fue a horario (puntualidad real). Sin esto, la opción no se ofrece. */
  onYaLlego?: (aHorario: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [llegadaOpen, setLlegadaOpen] = useState(false);
  const step = nextStepFor(shift);

  // La misma regla que el diálogo y el servidor (`isCancellable`): con la
  // salida marcada ya no se ofrece cancelar, se finaliza y se paga (U081).
  const canCancel = isCancellable(shift.status);
  // La hora corre mientras la tarjeta está abierta: se relee cada medio
  // minuto para que «Ya llegó» aparezca sola a la hora de inicio y «No se
  // presentó», a los 10 minutos.
  // Sólo corre si la opción puede aparecer (turno confirmado o en camino) y con
  // la pestaña a la vista (`useNow`): en el resto de las tarjetas no dibuja nada.
  const now = useNow(30_000, NO_SHOW_ELIGIBLE.includes(shift.status));
  const canNoShow = NO_SHOW_ELIGIBLE.includes(shift.status) && puedeMarcarAusencia(shift, now);
  // Desde la hora de inicio, si la persona no marcó la llegada, el comercio
  // tiene la última palabra: «Ya llegó» (acá) o «No se presentó» (en «Más»).
  const canYaLlego =
    Boolean(onYaLlego) && NO_SHOW_ELIGIBLE.includes(shift.status) && puedeMarcarLlegada(shift, now);
  // Pasada la hora y sin llegada marcada, «Confirmó. Te avisamos cuando salga
  // para allá» ya no es lo que pasa: se dice lo que falta.
  const nombre = firstNameOf(shift.worker_name);
  const hint =
    canYaLlego && !shift.en_route_at
      ? `${nombre ?? "La persona"} todavía no marcó la llegada.`
      : step.hint;
  const hasWorker = Boolean(shift.worker_profile_id) && shift.status !== "cancelado";
  // Decisión 24: con la salida marcada, cuándo lo cierra Oído si no lo cierra
  // el comercio. Va en la misma línea del estado, sin color propio.
  const autoFinish =
    shift.status === "check_out" ? autoFinishPhrase(shift.check_out_at, new Date(now)) : null;

  return (
    <div className="flex flex-col gap-2.5">
      {hint && (
        <p className="text-sm text-ink-soft">
          {shift.status === "pagado" && (
            <CheckCircleIcon size={15} className="mr-1 inline-block align-[-2px] text-success-text" />
          )}
          {hint}
          {autoFinish && ` Si no lo cerrás, se cierra solo ${autoFinish}.`}
        </p>
      )}

      {/* La fila se parte si no entra: a 320 px «Marcar como pagado» se partía
          en tres renglones al lado de «Chat» y «Más»; ahora el principal pide
          11 rem (lo que mide en un renglón) y, si no los tiene, los otros dos
          bajan (revisión del 2026-11-19). A 390 px entran los tres. */}
      <div className="flex flex-wrap items-center gap-2">
        {step.action === "candidates" ? (
          <Link
            href={`/shifts/${shift.id}/candidates`}
            className="boton boton-hondo flex min-h-[40px] flex-1 basis-44 items-center justify-center px-4 py-2 text-center text-sm font-semibold transition active:scale-[0.98]"
          >
            {step.actionLabel}
          </Link>
        ) : step.action ? (
          <Button
            size="sm"
            variant="surface"
            className="boton-hondo flex-1 basis-44"
            onClick={() =>
              step.action === "markPaid"
                ? onMarkPaid()
                : onRun(shift.id, step.action as Exclude<PrimaryAction, "candidates" | "markPaid">)
            }
            loading={busy === `${shift.id}:${step.action}`}
            disabled={locked}
          >
            {step.actionLabel}
          </Button>
        ) : canYaLlego ? (
          <Button
            size="sm"
            variant="surface"
            className="boton-hondo flex-1 basis-44"
            onClick={() => setLlegadaOpen(true)}
            loading={busy === `${shift.id}:yaLlego`}
            disabled={locked}
          >
            Ya llegó
          </Button>
        ) : null}

        {/* «Chat» y «Más» van juntos: si no entran al lado del principal,
            bajan los dos (sueltos, en las tarjetas de la grilla de escritorio
            bajaba «Más» sola). */}
        <div className="flex shrink-0 gap-2">
          {hasWorker && (
            <Link
              href={`/chats/${shift.id}`}
              aria-label="Abrir chat con el trabajador"
              className={QUIETO}
            >
              <MessageIcon size={16} /> Chat
            </Link>
          )}

          <button
            type="button"
            aria-label="Más acciones"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className={QUIETO}
          >
            Más
          </button>
        </div>
      </div>

      {/* Antes era un dropdown `position: absolute` anclado al botón "Más":
          en mobile terminaba con la esquina fuera de la pantalla (recortado,
          casi ilegible) y en desktop se abría como una ventanita rara —
          dependía de cuánto lugar quedaba a la derecha del botón, que varía
          con el layout de cada tarjeta (bug real con captura, Julieta
          2026-07-31). `Sheet` es `position: fixed` a toda la pantalla — nunca
          se puede recortar ni desalinear, y es el mismo patrón que ya usan
          `/map` y `/shifts/new` para acciones desde una tarjeta. */}
      <Sheet open={llegadaOpen} onClose={() => setLlegadaOpen(false)} title="¿Llegó a horario?">
        <p className="px-3.5 pb-2 text-sm text-ink-soft">
          Todavía no marcó la llegada en la app. Lo que digas queda en su puntualidad.
        </p>
        <div className="flex flex-col gap-1 pb-2">
          <MenuButton
            disabled={locked}
            onClick={() => {
              setLlegadaOpen(false);
              onYaLlego?.(true);
            }}
          >
            Sí, llegó a horario
          </MenuButton>
          <MenuButton
            disabled={locked}
            onClick={() => {
              setLlegadaOpen(false);
              onYaLlego?.(false);
            }}
          >
            Llegó tarde
          </MenuButton>
        </div>
      </Sheet>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Más acciones">
        <div className="flex flex-col gap-1 pb-2">
          {hasWorker && (
            <MenuLink href={`/workers/${shift.worker_profile_id}`}>
              Ver perfil del trabajador
            </MenuLink>
          )}
          {shift.status === "publicado" && (
            <div className="px-3.5 py-1.5">
              <ShareShiftButton shift={shift} shiftId={shift.id} />
            </div>
          )}
          {shift.is_editable && (
            <MenuLink href={`/shifts/${shift.id}/edit`}>
              <PencilIcon size={15} /> Editar turno
            </MenuLink>
          )}
          <MenuLink href={`/shifts/new?duplicate=${shift.id}`}>
            <CopyIcon size={15} /> Duplicar turno
          </MenuLink>
          {canNoShow && (
            <MenuButton
              disabled={locked}
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
              disabled={locked}
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
      className="fila-hoja"
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
      className={`fila-hoja ${danger ? "text-danger-text" : ""}`}
    >
      {children}
    </button>
  );
}
