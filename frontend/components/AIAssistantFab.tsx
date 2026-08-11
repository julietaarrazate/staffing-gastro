"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { ParsedShiftDraft } from "@/lib/types";
import { useVoiceDictation } from "@/lib/use-voice-dictation";
import Sheet from "@/components/ui/Sheet";
import { Button } from "@/components/ui";
import { MicIcon, MicOffIcon, SparklesIcon } from "@/components/icons";

/** Clave de sessionStorage para pasarle el draft ya parseado al wizard de
 * /shifts/new (ver el efecto de handoff en esa página). */
export const AI_SHIFT_DRAFT_STORAGE_KEY = "staffya_ai_shift_draft";

/**
 * Asistente de turnos con IA, como botón flotante disponible en toda la app
 * (pedido de Julieta: separado del wizard, no sólo dentro de él). Sólo el
 * comercio publica turnos — nada que ofrecerle acá a un trabajador/admin.
 * Se oculta en /shifts/new, que ya tiene el mismo cuadro de texto+dictado
 * integrado en su paso 1 (evita mostrar dos entradas para lo mismo).
 *
 * Reusa el endpoint `POST /shifts/parse-text` (mismo que el wizard); la
 * única diferencia es que acá el resultado no se aplica in-place (el
 * componente no tiene el estado del formulario) sino que se guarda y se
 * navega al wizard, que lo aplica al montar — nunca crea ni publica nada
 * por su cuenta, mismo criterio de "la IA sólo precarga" que ya regía.
 */
export default function AIAssistantFab() {
  const { user, token } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { listening, supported: speechSupported, toggle: toggleDictation } = useVoiceDictation(
    (transcript) => setText((prev) => (prev ? `${prev} ${transcript}` : transcript).slice(0, 500))
  );

  if (user?.role !== "employer" || pathname === "/shifts/new") return null;

  async function handleSubmit() {
    if (!token || !text.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const draft = await api.post<ParsedShiftDraft>(
        "/shifts/parse-text",
        { text: text.trim() },
        token
      );
      sessionStorage.setItem(AI_SHIFT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setOpen(false);
      setText("");
      router.push("/shifts/new?ai=1");
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos interpretar el texto. Probá describirlo distinto."));
    } finally {
      setLoading(false);
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
      <Sheet open={open} onClose={() => setOpen(false)} title="Asistente de turnos">
        <div className="pb-6">
          <p className="text-sm text-ink/60">
            Contame qué turno necesitás — escribilo o dictalo — y te llevo directo a revisarlo,
            desde donde estés.
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
              Completar turno
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
