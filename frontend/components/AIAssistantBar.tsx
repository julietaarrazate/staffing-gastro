"use client";

import { useRouter } from "next/navigation";
import { SparklesIcon } from "@/components/icons";

/**
 * Barra prominente del asistente de IA: punto de entrada único en toda la
 * app, tanto para el panel/home del comercio (`/shifts`) como para el Inicio
 * del trabajador (`/feed`) — ya no existe una cápsula flotante alternativa
 * (Julieta, 2026-08-16: "no quiero botones flotantes"; antes había una,
 * `AIAssistantFab`, que este componente reemplazó primero en `/shifts` y
 * después en `/feed`, hasta que se sacó del todo). Pedido explícito de
 * Julieta ("es un rectángulo preguntando qué necesitás? no un botoncito",
 * referencia: barra de búsqueda de Tegu). Navega a `/assistant` — la
 * pantalla dedicada (mismo pedido de Julieta: "que no sea un botón
 * escondido, que tenga su lugar para pedirle"), no una hoja que se abre
 * encima.
 *
 * Fondo blanco, no `bg-surface` (reporte real de Julieta con captura
 * marcada: "sigue todo muy beige") — Arena sobre el fondo crema del panel
 * casi no diferencia, igual que el bug ya corregido en la tarjeta vacía de
 * `/assistant`; blanco + sombra es el mismo tratamiento que el resto de las
 * superficies flotantes de la app (`ShiftCard`, barra de ubicación).
 */
export default function AIAssistantBar() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/assistant")}
      className="flex w-full items-center gap-3 rounded-full bg-card px-4 py-3.5 text-left shadow-[var(--shadow-soft)] ring-1 ring-line transition active:scale-[0.99]"
    >
      {/* Sin tile naranja ni isotipo (2026-09, reporte de Julieta sobre el
          feed: "está sobrecargado el ícono del asistente, el ícono de oído, el
          círculo del comercio, es demasiada cosa").
          Dos problemas en un solo elemento: el isotipo de Oído ya estaba en el
          navbar de la misma pantalla, así que la marca aparecía DOS veces; y su
          tile naranja competía con el avatar y con el círculo del comercio —
          cuatro círculos, dos de ellos del mismo naranja, contra la regla de
          CLAUDE.md de "un solo acento naranja por pantalla".
          El logo identifica a la app, no a una función dentro de la app: acá va
          el ícono convencional de asistente, en tinta, sin fondo propio. */}
      <SparklesIcon size={18} className="shrink-0 text-ink/45" />
      <span className="text-sm font-medium text-ink/60">¿Qué necesitás?</span>
    </button>
  );
}
