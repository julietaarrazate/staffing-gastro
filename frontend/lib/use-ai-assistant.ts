"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { AssistantQueryResponse, ParsedShiftDraft } from "@/lib/types";
import { useVoiceDictation } from "@/lib/use-voice-dictation";

/** Claves de sessionStorage para pasarle el draft ya parseado al wizard
 * correspondiente (ver los efectos de handoff en esas páginas). */
export const AI_SHIFT_DRAFT_STORAGE_KEY = "staffya_ai_shift_draft";
export const AI_EVENT_DRAFT_STORAGE_KEY = "staffya_ai_event_draft";

/** Draft de evento (`crear_evento`): comparte un único `pay_amount`/horario
 * para todos los roles — cada uno se puede ajustar a mano en el wizard. */
export interface AssistantEventDraft {
  event_positions: { position: string; quantity: number }[];
  start_at: string | null;
  end_at: string | null;
  pay_amount: string | null;
  urgent: boolean;
  meal: boolean;
  tips: boolean;
  dress_code: string | null;
}

export interface InlineResult {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Lógica compartida del asistente de IA del comercio (clasifica intención vía
 * `POST /assistant/query` y rama según el resultado) — separada de la
 * presentación del disparador (`AIAssistantFab` cápsula flotante,
 * `AIAssistantBar` barra prominente de home) para que ambas compartan el
 * mismo comportamiento sin duplicar lógica.
 */
export function useAIAssistant() {
  const { token } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inlineResult, setInlineResult] = useState<InlineResult | null>(null);
  const { listening, supported: speechSupported, toggle: toggleDictation } = useVoiceDictation(
    (transcript) => setText((prev) => (prev ? `${prev} ${transcript}` : transcript).slice(0, 500))
  );

  function reset() {
    setText("");
    setInlineResult(null);
    setError(null);
  }

  function closeAndGo(to: string) {
    setOpen(false);
    reset();
    router.push(to);
  }

  function handleResult(result: AssistantQueryResponse) {
    switch (result.intent) {
      case "crear_turno": {
        const draft: ParsedShiftDraft = {
          position: result.position,
          start_at: result.start_at,
          end_at: result.end_at,
          pay_amount: result.pay_amount,
          urgent: result.urgent ?? false,
          meal: result.meal ?? false,
          tips: result.tips ?? true,
          dress_code: result.dress_code,
        };
        sessionStorage.setItem(AI_SHIFT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
        closeAndGo("/shifts/new?ai=1");
        return;
      }
      case "crear_evento": {
        const draft: AssistantEventDraft = {
          event_positions: result.event_positions ?? [],
          start_at: result.start_at,
          end_at: result.end_at,
          pay_amount: result.pay_amount,
          urgent: result.urgent ?? false,
          meal: result.meal ?? false,
          tips: result.tips ?? true,
          dress_code: result.dress_code,
        };
        sessionStorage.setItem(AI_EVENT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
        closeAndGo("/shifts/new-event?ai=1");
        return;
      }
      case "buscar_candidatos": {
        const query = result.search_position ? `?skill=${result.search_position}` : "";
        closeAndGo(`/search${query}`);
        return;
      }
      case "ver_postulantes": {
        if (result.matched_shift_id) {
          closeAndGo(`/shifts/${result.matched_shift_id}/candidates`);
          return;
        }
        setInlineResult({ message: "No encontré un turno tuyo así — revisalo en el panel." });
        return;
      }
      case "consultar_turnos": {
        setInlineResult({
          message: result.query_summary ?? "Listo.",
          actionLabel: "Ver en el panel",
          onAction: () => closeAndGo(`/shifts?tab=${result.query_tab ?? "todos"}`),
        });
        return;
      }
      default: {
        setInlineResult({ message: result.message ?? "No entendí bien qué necesitás. ¿Podés reformularlo?" });
      }
    }
  }

  async function handleSubmit() {
    if (!token || !text.trim()) return;
    setError(null);
    setInlineResult(null);
    setLoading(true);
    try {
      const result = await api.post<AssistantQueryResponse>(
        "/assistant/query",
        { text: text.trim() },
        token
      );
      handleResult(result);
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos interpretar el texto. Probá describirlo distinto."));
    } finally {
      setLoading(false);
    }
  }

  return {
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
  };
}
