"use client";

// Prompt de opt-in de notificaciones push. Se dispara explícitamente desde
// el código de negocio tras una acción significativa del usuario (primera
// postulación, primer turno publicado — NUNCA al aterrizar en la app, ver
// docs/ACCESO_MODERNO.md), vía `usePushPrompt().requestOptIn()`.

import { createContext, useContext, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { isPushSupported, subscribeToPush } from "@/lib/push";
import { Sheet, Button } from "@/components/ui";
import { BellIcon } from "@/components/icons";

const PROMPT_SHOWN_KEY = "staffya_push_prompt_shown";

interface PushPromptState {
  /** Muestra el prompt si corresponde (soportado, todavía no se decidió a
   * nivel navegador, y no se le mostró antes en este dispositivo). No-op en
   * caso contrario — seguro de llamar desde cualquier acción de negocio. */
  requestOptIn: () => void;
}

const PushPromptContext = createContext<PushPromptState | null>(null);

function alreadyDecided(): boolean {
  if (typeof window === "undefined") return true;
  if (localStorage.getItem(PROMPT_SHOWN_KEY)) return true;
  if (typeof Notification !== "undefined" && Notification.permission !== "default") return true;
  return false;
}

export function PushPromptProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function requestOptIn() {
    if (!isPushSupported() || alreadyDecided()) return;
    setOpen(true);
  }

  function dismiss() {
    localStorage.setItem(PROMPT_SHOWN_KEY, "1");
    setOpen(false);
  }

  async function accept() {
    if (!token) return dismiss();
    setLoading(true);
    try {
      await subscribeToPush(token);
    } catch {
      // Best-effort: si algo falla (permiso denegado tarde, red, etc.) no
      // rompe nada — el usuario puede activarlo después desde su perfil.
    } finally {
      setLoading(false);
      dismiss();
    }
  }

  return (
    <PushPromptContext.Provider value={{ requestOptIn }}>
      {children}
      <Sheet open={open} onClose={dismiss}>
        <div className="flex flex-col items-center pb-2 pt-1 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BellIcon size={22} />
          </span>
          <h3 className="mt-3 text-base font-bold text-ink">Activá las notificaciones</h3>
          <p className="mt-1 text-sm text-ink/60">
            Enterate al instante cuando te asignen un turno, te escriban o cambie el estado
            de tu postulación.
          </p>
          <div className="mt-5 flex w-full gap-3 pb-1">
            <Button variant="surface" fullWidth onClick={dismiss} disabled={loading}>
              Ahora no
            </Button>
            <Button fullWidth onClick={accept} loading={loading}>
              Activar
            </Button>
          </div>
        </div>
      </Sheet>
    </PushPromptContext.Provider>
  );
}

export function usePushPrompt(): PushPromptState {
  const ctx = useContext(PushPromptContext);
  if (!ctx) throw new Error("usePushPrompt debe usarse dentro de PushPromptProvider");
  return ctx;
}
