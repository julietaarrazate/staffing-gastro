"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Focus trap para diálogos modales (`Modal`, `Sheet`). Hallazgo F1 de la
 * auditoría de producto/UI 2026-08-09: ambos ya tenían `role="dialog"` +
 * `aria-modal="true"` (correcto para lectores de pantalla), pero ninguno
 * atrapaba `Tab`/`Shift+Tab` dentro del diálogo, movía el foco al abrir, ni
 * lo restauraba al cerrar — un usuario de teclado podía tabular hacia
 * contenido de fondo tapado visualmente por el backdrop.
 *
 * `containerRef` debe apuntar al elemento con `role="dialog"`. `active`
 * espeja el `open` del diálogo — el trap sólo corre mientras está abierto.
 */
export function useFocusTrap<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  active: boolean
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Mueve el foco adentro del diálogo: al primer elemento focuseable, o al
    // contenedor mismo (con un tabindex temporal) si no hay ninguno.
    const focusables = getFocusable(container);
    let addedTabIndex = false;
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      if (!container.hasAttribute("tabindex")) {
        container.setAttribute("tabindex", "-1");
        addedTabIndex = true;
      }
      container.focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !container) return;
      const items = getFocusable(container);
      if (items.length === 0) {
        // Nada focuseable adentro: no dejar que Tab se escape del diálogo.
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (current === last || !container.contains(current)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (addedTabIndex) container.removeAttribute("tabindex");
      // Restaura el foco a donde estaba antes de abrir el diálogo (p. ej. el
      // botón que lo disparó) — sin esto, tras cerrar con teclado el foco
      // queda huérfano en el `<body>`.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
}
