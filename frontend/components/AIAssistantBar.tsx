"use client";

import { useAIAssistant } from "@/lib/use-ai-assistant";
import AIAssistantSheet from "@/components/AIAssistantSheet";
import { SparklesIcon } from "@/components/icons";

/**
 * Barra prominente del asistente de IA, para el panel/home del comercio
 * (`/shifts`) — reemplaza ahí a la cápsula flotante (`AIAssistantFab`, que se
 * oculta en esta pantalla) con un punto de entrada principal, no secundario:
 * pedido explícito de Julieta ("es un rectángulo preguntando qué necesitás?
 * no un botoncito", referencia: barra de búsqueda de Tegu). Misma lógica de
 * intents que la cápsula (`useAIAssistant`) — sólo cambia la presentación
 * del disparador.
 */
export default function AIAssistantBar() {
  const assistant = useAIAssistant();

  return (
    <>
      <button
        type="button"
        onClick={() => assistant.setOpen(true)}
        className="flex w-full items-center gap-3 rounded-full bg-surface px-4 py-3.5 text-left ring-1 ring-line transition active:scale-[0.99]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <SparklesIcon size={16} />
        </span>
        <span className="text-sm font-medium text-ink/50">¿Qué necesitás?</span>
      </button>
      <AIAssistantSheet assistant={assistant} />
    </>
  );
}
