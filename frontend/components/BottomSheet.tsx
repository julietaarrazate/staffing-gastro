"use client";

import { useState } from "react";

const PEEK_HEIGHT = 140;

/**
 * Bandeja deslizable estilo app (Uber/Morfi) que se superpone a un mapa a
 * pantalla completa. Se puede arrastrar el handle (o tocarlo) para expandir
 * entre un estado "peek" (asoma el resultado) y uno expandido (lista completa).
 */
export default function BottomSheet({
  header,
  children,
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [startY, setStartY] = useState(0);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setDragging(true);
    setStartY(e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragOffset(e.clientY - startY);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dragOffset) < 6) {
      setExpanded((v) => !v);
    } else if (dragOffset < -40) {
      setExpanded(true);
    } else if (dragOffset > 40) {
      setExpanded(false);
    }
    setDragOffset(0);
  }

  const collapsedTransform = `calc(100% - ${PEEK_HEIGHT}px)`;
  const baseTransform = expanded ? "0px" : collapsedTransform;
  const transform = dragging ? `calc(${baseTransform} + ${dragOffset}px)` : baseTransform;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 flex h-[78dvh] flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.15)] ${
        dragging ? "" : "transition-transform duration-200 ease-out"
      }`}
      style={{ transform: `translateY(${transform})` }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-2 pb-1 pt-2.5 active:cursor-grabbing"
      >
        <span className="h-1.5 w-10 rounded-full bg-zinc-300" />
      </div>
      {header}
      {/* `overscroll-behavior-y: contain` (además del fix en `html` de
          globals.css, docs/PULIDO_ROADMAP.md fix 3): al llegar al tope/fondo
          de esta lista, el scroll no debe "escalar" al documento y disparar
          el pull-to-refresh nativo del navegador. */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 pb-4">{children}</div>
    </div>
  );
}
