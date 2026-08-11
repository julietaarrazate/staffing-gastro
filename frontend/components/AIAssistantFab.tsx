"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { AssistantQueryResponse, ParsedShiftDraft } from "@/lib/types";
import { useVoiceDictation } from "@/lib/use-voice-dictation";
import Sheet from "@/components/ui/Sheet";
import { Button } from "@/components/ui";
import { MicIcon, MicOffIcon, SparklesIcon } from "@/components/icons";

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

interface InlineResult {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Asistente general del panel del comercio, como botón flotante disponible
 * en toda la app (pedido de Julieta: separado del wizard, "un botón
 * afuera", y que entienda "si es un evento, si es un turno, y toda la app,
 * no sólo lo básico"). Una sola llamada a `POST /assistant/query` clasifica
 * la intención — crear turno, crear evento, consultar turnos propios,
 * buscar candidatos, o ver postulantes de un turno — y esta pantalla rama
 * según el `intent` que vuelve. Sólo el comercio publica turnos y ve sus
 * propios postulantes — nada que ofrecerle acá a un trabajador/admin.
 *
 * Se oculta en /shifts/new y /shifts/new-event, que ya tienen su propio
 * cuadro de texto+dictado integrado (evita dos entradas para lo mismo en
 * la misma pantalla).
 *
 * Ningún intent PUBLICA ni EJECUTA nada solo: crear_turno/crear_evento sólo
 * precargan el wizard correspondiente (el comercio revisa y confirma cada
 * paso a mano); consultar_turnos/buscar_candidatos/ver_postulantes son de
 * sólo lectura, navegan o resumen sin tocar ningún dato.
 */
export default function AIAssistantFab() {
  const { user, token } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inlineResult, setInlineResult] = useState<InlineResult | null>(null);
  const { listening, supported: speechSupported, toggle: toggleDictation } = useVoiceDictation(
    (transcript) => setText((prev) => (prev ? `${prev} ${transcript}` : transcript).slice(0, 500))
  );

  const hiddenOnThisPage = pathname === "/shifts/new" || pathname === "/shifts/new-event";
  if (user?.role !== "employer" || hiddenOnThisPage) return null;

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Asistente de turnos con IA"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[var(--shadow-float)] transition active:scale-95 md:bottom-6 md:right-6"
      >
        <SparklesIcon size={22} />
      </button>
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
    </>
  );
}
