"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAIAssistant } from "@/lib/use-ai-assistant";
import { Button, Skeleton } from "@/components/ui";
import { LogoGlyph } from "@/components/Logo";
import { ChevronLeftIcon, MicIcon, MicOffIcon } from "@/components/icons";

/**
 * Pantalla dedicada del asistente de IA del comercio (pedido de Julieta:
 * "que no sea un botón escondido, que tenga su lugar para pedirle") —
 * reemplaza la hoja modal que abrían `AIAssistantFab`/`AIAssistantBar`. Cada
 * intercambio se agrega al historial de ESTA visita (no persiste al salir:
 * la memoria entre sesiones es una decisión aparte, todavía no tomada — ver
 * `AssistantQueryLogEntry` en el backend para la señal que sí se guarda,
 * como base de un aprendizaje real cuando haya volumen).
 */
export default function AssistantPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const {
    text,
    setText,
    loading,
    error,
    history,
    listening,
    speechSupported,
    toggleDictation,
    handleSubmit,
  } = useAIAssistant();
  const historyEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Es una herramienta del panel del comercio (mismo alcance que la cápsula/
  // barra que reemplaza) — un trabajador que llega acá por URL directa se va
  // a su home, no ve una pantalla rota o vacía.
  useEffect(() => {
    if (!authLoading && user && user.role !== "employer") router.replace("/feed");
  }, [authLoading, user, router]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length]);

  // Foco inicial en el campo (jsx-a11y/no-autofocus: el atributo `autoFocus`
  // de JSX roba el foco incluso cuando el usuario llega por otro camino que
  // no sea "recién abrí esta pantalla para escribir"; enfocar a mano en un
  // efecto es el mismo resultado sin ese problema — acá vale la pena, es
  // literalmente una pantalla de chat, todo el punto es escribir de una).
  useEffect(() => {
    if (!authLoading && user?.role === "employer") textareaRef.current?.focus();
  }, [authLoading, user]);

  if (authLoading || !user || user.role !== "employer") {
    return (
      <div className="mx-auto max-w-md px-4 py-4">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem-5rem)] max-w-md flex-col px-4 pb-4 pt-4 md:min-h-[calc(100dvh-4rem)]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Cerrar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink/60 ring-1 ring-line"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <h1 className="font-display text-lg font-semibold text-ink">Asistente</h1>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {history.length === 0 ? (
          // Tarjeta blanca, no bg-surface (reporte real de Julieta: "todo
          // beige, se confunde, parece teñido") — bg-surface es para chips/
          // insets (ver DESIGN_TOKENS.md §3.1), no para la única tarjeta de
          // contenido de una pantalla vacía; mismo tratamiento que el resto
          // de las tarjetas reales de la app (perfil, resumen del wizard).
          // El ícono usa Espresso (ADR-0011, "momento de marca") en vez de
          // naranja — distingue esta tarjeta de bienvenida de los globos de
          // chat de abajo, que sí son naranja/superficie.
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-4 py-8 text-center shadow-[var(--shadow-soft)] ring-1 ring-line">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-structure)]">
              <LogoGlyph size={18} color="#fff" />
            </span>
            <p className="text-sm text-ink/60">
              Contame qué necesitás — publicar un turno o evento, ver tus turnos, buscar
              candidatos, quién se postuló a algo, o si un postulante está verificado.
            </p>
          </div>
        ) : (
          history.map((entry) => (
            <div key={entry.id} className="space-y-1.5">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2 text-sm text-ink">
                {entry.question}
              </p>
              <div className="mr-auto w-fit max-w-[85%] rounded-2xl rounded-tl-md bg-surface px-3.5 py-2.5">
                <p className="text-sm text-ink">{entry.result.message}</p>
                {entry.result.actionLabel && entry.result.onAction && (
                  <Button
                    type="button"
                    size="sm"
                    variant="surface"
                    className="mt-2"
                    onClick={entry.result.onAction}
                  >
                    {entry.result.actionLabel}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={historyEndRef} />
      </div>

      <div className="sticky bottom-0 mt-3 bg-background pt-1">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Ej: necesito un mozo el sábado a la noche, se paga 45000"
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
      </div>
    </div>
  );
}
