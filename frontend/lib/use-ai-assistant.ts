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

/** Un intercambio ya resuelto (pregunta del comercio + respuesta del
 * asistente) — el "lugar propio" del asistente (`/assistant`, pedido de
 * Julieta: "que no sea un botón escondido, que tenga su lugar para
 * pedirle") se siente como una conversación, no como un formulario de un
 * solo uso. Vive sólo en memoria de esta visita a la página — no es la
 * memoria persistente entre sesiones que Julieta decidió no construir
 * todavía (ver `AssistantQueryLogEntry` en el backend para la señal que sí
 * se guarda, como base de un aprendizaje real futuro). */
export interface AssistantHistoryEntry {
  id: string;
  question: string;
  result: InlineResult;
}

/**
 * Lógica compartida del asistente de IA del comercio (clasifica intención vía
 * `POST /assistant/query` y rama según el resultado) — separada de la
 * presentación (`/assistant`, la pantalla dedicada) para que el disparador
 * (`AIAssistantBar`, que sólo navega ahí) no cargue
 * con esta lógica.
 */
export function useAIAssistant() {
  const { token } = useAuth();
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AssistantHistoryEntry[]>([]);
  const { listening, supported: speechSupported, toggle: toggleDictation } = useVoiceDictation(
    (transcript) => setText((prev) => (prev ? `${prev} ${transcript}` : transcript).slice(0, 500))
  );

  function reset() {
    setText("");
    setError(null);
  }

  function goTo(to: string) {
    reset();
    router.push(to);
  }

  /** Agrega el intercambio al historial de la sesión y limpia el campo de
   * texto para la próxima pregunta — mismo gesto que un chat. */
  function showInline(question: string, result: InlineResult) {
    setHistory((prev) => [...prev, { id: crypto.randomUUID(), question, result }]);
    setText("");
  }

  function handleResult(question: string, result: AssistantQueryResponse) {
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
        goTo("/shifts/new?ai=1");
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
        goTo("/shifts/new-event?ai=1");
        return;
      }
      case "buscar_candidatos": {
        const query = result.search_position ? `?skill=${result.search_position}` : "";
        goTo(`/search${query}`);
        return;
      }
      case "ver_postulantes": {
        if (result.matched_shift_id) {
          goTo(`/shifts/${result.matched_shift_id}/candidates`);
          return;
        }
        showInline(question, { message: "No encontré un turno tuyo así — revisalo en el panel." });
        return;
      }
      case "consultar_turnos": {
        showInline(question, {
          message: result.query_summary ?? "Listo.",
          actionLabel: "Ver en el panel",
          onAction: () => goTo(`/shifts?tab=${result.query_tab ?? "todos"}`),
        });
        return;
      }
      case "consultar_verificacion": {
        const name = result.verification_full_name ?? "Esa persona";
        showInline(question, {
          message: result.verification_verified
            ? `Sí, ${name} tiene la identidad verificada.`
            : `No, ${name} todavía no verificó su identidad.`,
        });
        return;
      }
      default: {
        showInline(question, {
          message: result.message ?? "No entendí bien qué necesitás. ¿Podés reformularlo?",
        });
      }
    }
  }

  async function handleSubmit() {
    const question = text.trim();
    if (!token || !question) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<AssistantQueryResponse>(
        "/assistant/query",
        { text: question },
        token
      );
      handleResult(question, result);
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos interpretar el texto. Probá describirlo distinto."));
    } finally {
      setLoading(false);
    }
  }

  return {
    text,
    setText,
    loading,
    error,
    history,
    listening,
    speechSupported,
    toggleDictation,
    handleSubmit,
  };
}
