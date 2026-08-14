"use client";

import Sheet from "@/components/ui/Sheet";
import { Button } from "@/components/ui";
import { MicIcon, MicOffIcon } from "@/components/icons";
import type { useAIAssistant } from "@/lib/use-ai-assistant";

/**
 * Hoja del asistente, compartida por `AIAssistantFab` y `AIAssistantBar` — el
 * disparador cambia de presentación, el comportamiento (dictado, envío,
 * resultado inline) es siempre el mismo.
 */
export default function AIAssistantSheet({
  assistant,
}: {
  assistant: ReturnType<typeof useAIAssistant>;
}) {
  const {
    open,
    setOpen,
    text,
    setText,
    loading,
    error,
    inlineResult,
    listening,
    speechSupported,
    toggleDictation,
    reset,
    handleSubmit,
  } = assistant;

  return (
    <Sheet open={open} onClose={() => { setOpen(false); reset(); }} title="Asistente">
      <div className="pb-6">
        <p className="text-sm text-ink/60">
          Contame qué necesitás — publicar un turno o evento, ver tus turnos, buscar candidatos,
          o quién se postuló a algo — escribilo o dictalo.
        </p>
        <div className="relative mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ej: necesito un mozo el sábado a la noche, se paga 45000"
            autoFocus
            className={`w-full resize-none rounded-2xl bg-surface px-3.5 py-2.5 text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-primary/40 ${
              speechSupported ? "pr-10" : ""
            }`}
          />
          {speechSupported && (
            <button
              type="button"
              onClick={toggleDictation}
              aria-label={listening ? "Detener dictado" : "Dictar por voz"}
              aria-pressed={listening}
              className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition ${
                listening
                  ? "animate-pulse bg-danger text-white"
                  : "bg-white text-ink/50 ring-1 ring-line"
              }`}
            >
              {listening ? <MicOffIcon size={14} /> : <MicIcon size={14} />}
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {listening ? (
            <p className="text-xs font-semibold text-primary-text">Escuchando…</p>
          ) : (
            error && <p className="text-xs text-danger-text">{error}</p>
          )}
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            disabled={!text.trim()}
            loading={loading}
            onClick={handleSubmit}
          >
            Completar
          </Button>
        </div>
        {inlineResult && (
          <div className="mt-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
            <p className="text-sm text-ink">{inlineResult.message}</p>
            {inlineResult.actionLabel && inlineResult.onAction && (
              <Button
                type="button"
                size="sm"
                variant="surface"
                className="mt-2"
                onClick={inlineResult.onAction}
              >
                {inlineResult.actionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
