"use client";

import { useRouter } from "next/navigation";
import { SparklesIcon } from "@/components/icons";

/**
 * Barra prominente del asistente de IA, para el panel/home del comercio
 * (`/shifts`) — reemplaza ahí a la cápsula flotante (`AIAssistantFab`, que se
 * oculta en esta pantalla) con un punto de entrada principal, no secundario:
 * pedido explícito de Julieta ("es un rectángulo preguntando qué necesitás?
 * no un botoncito", referencia: barra de búsqueda de Tegu). Navega a
 * `/assistant` — la pantalla dedicada (mismo pedido de Julieta: "que no sea
 * un botón escondido, que tenga su lugar para pedirle"), no una hoja que se
 * abre encima.
 */
export default function AIAssistantBar() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/assistant")}
      className="flex w-full items-center gap-3 rounded-full bg-surface px-4 py-3.5 text-left ring-1 ring-line transition active:scale-[0.99]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <SparklesIcon size={16} />
      </span>
      <span className="text-sm font-medium text-ink/50">¿Qué necesitás?</span>
    </button>
  );
}
