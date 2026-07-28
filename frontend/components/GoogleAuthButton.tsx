"use client";

// Botón "Continuar con Google" (Google Identity Services) + el paso de
// selección de rol para cuentas nuevas. Un solo componente reutilizado por
// /login y /register (CLAUDE.md: "no dupliques lógica"): el flujo de Google
// es el mismo desde ambas pantallas, sólo cambia adónde navega al terminar.
//
// Flag por ausencia (mismo patrón que el resto del proyecto, ver
// docs/ACCESO_MODERNO.md): sin `NEXT_PUBLIC_GOOGLE_CLIENT_ID` seteada, este
// componente no renderiza nada — ni carga el script de Google.

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleAuthButton({
  onDone,
}: {
  /** Se llama cuando la sesión queda lista. `isNewAccount` distingue "recién
   * creada" (para mandar a completar perfil) de "ya existía" (a home). */
  onDone: (isNewAccount: boolean) => void;
}) {
  const { loginWithGoogle } = useAuth();
  const buttonHostRef = useRef<HTMLDivElement>(null);
  const idTokenRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [pendingRole, setPendingRole] = useState<{ email: string; fullName: string } | null>(
    null
  );
  const [roleLoading, setRoleLoading] = useState<"worker" | "employer" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCredential(idToken: string) {
    setError(null);
    idTokenRef.current = idToken;
    try {
      const result = await loginWithGoogle(idToken);
      if (result.requiresRole) {
        setPendingRole({ email: result.email, fullName: result.fullName });
      } else {
        onDone(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo continuar con Google");
    }
  }

  useEffect(() => {
    if (!scriptReady || !GOOGLE_CLIENT_ID || !buttonHostRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        void handleCredential(response.credential);
      },
    });
    window.google.accounts.id.renderButton(buttonHostRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      locale: "es",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady]);

  async function chooseRole(role: "worker" | "employer") {
    if (!idTokenRef.current) return;
    setError(null);
    setRoleLoading(role);
    try {
      const result = await loginWithGoogle(idTokenRef.current, role);
      if (!result.requiresRole) onDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo crear la cuenta con Google"
      );
    } finally {
      setRoleLoading(null);
    }
  }

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="mt-4">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-line" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-ink/40">o continuá con</span>
        </div>
      </div>

      {pendingRole ? (
        <div className="rounded-2xl bg-surface p-4 text-center ring-1 ring-line">
          <p className="text-sm font-semibold text-ink">
            ¿Buscás trabajo o buscás personal?
          </p>
          <p className="mt-1 text-xs text-ink/50">
            Elegí para terminar de crear tu cuenta de Google, {pendingRole.fullName}.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button
              variant="surface"
              size="sm"
              fullWidth
              loading={roleLoading === "worker"}
              disabled={roleLoading !== null}
              onClick={() => chooseRole("worker")}
            >
              Busco trabajo
            </Button>
            <Button
              variant="surface"
              size="sm"
              fullWidth
              loading={roleLoading === "employer"}
              disabled={roleLoading !== null}
              onClick={() => chooseRole("employer")}
            >
              Busco personal
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center" ref={buttonHostRef} />
      )}

      {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
