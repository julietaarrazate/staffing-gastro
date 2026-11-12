"use client";

import { useEffect, useRef } from "react";

/**
 * Pila de capas abiertas (Modal, Sheet, visor a pantalla completa) para que
 * Escape cierre SOLO la de más arriba. Antes cada capa escuchaba Escape por su
 * cuenta en el documento y, con dos abiertas a la vez, un Escape cerraba las
 * dos. Caso real: al publicar un turno se abren juntos la confirmación
 * «¡Turno publicado!» y, debajo, el pedido de activar notificaciones; un
 * Escape cerraba ambos y el pedido quedaba registrado como rechazado sin que
 * la persona lo hubiera visto.
 *
 * "Más arriba" = mayor `priority` (usar el z-index de la capa); a igual
 * prioridad, la que se abrió después. Un solo listener global para toda la pila.
 */

interface Layer {
  priority: number;
  close: () => void;
}

const stack: Layer[] = [];
let listening = false;

function topLayer(): Layer | undefined {
  let top: Layer | undefined;
  for (const layer of stack) {
    if (!top || layer.priority >= top.priority) top = layer;
  }
  return top;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  // Escape mantenido apretado: la repetición automática manda más `keydown` y
  // el segundo cerraría la capa de abajo sin que la persona la haya visto.
  if (e.repeat) return;
  topLayer()?.close();
}

function register(layer: Layer) {
  stack.push(layer);
  if (!listening) {
    document.addEventListener("keydown", onKeyDown);
    listening = true;
  }
}

function unregister(layer: Layer) {
  const i = stack.indexOf(layer);
  if (i >= 0) stack.splice(i, 1);
  if (stack.length === 0 && listening) {
    document.removeEventListener("keydown", onKeyDown);
    listening = false;
  }
}

/** Mientras `open`, la capa participa de la pila y `onClose` se llama cuando
 * Escape le toca (es la de más arriba). */
export function useEscapeLayer(open: boolean, onClose: () => void, priority = 0) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const layer: Layer = { priority, close: () => closeRef.current() };
    register(layer);
    return () => unregister(layer);
  }, [open, priority]);
}
