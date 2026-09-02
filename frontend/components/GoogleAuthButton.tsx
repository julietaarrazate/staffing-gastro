"use client";

// Botón "Continuar con Google" (Google Identity Services) + el paso de
// selección de rol para cuentas nuevas. Un solo componente reutilizado por
// /login y /register (CLAUDE.md: "no dupliques lógica"): el flujo de Google
// es el mismo desde ambas pantallas, sólo cambia adónde navega al terminar.
//
// Flag por ausencia (mismo patrón que el resto del proyecto, ver
// docs/reference/ACCESO_MODERNO.md): sin `NEXT_PUBLIC_GOOGLE_CLIENT_ID` seteada, este
// componente no renderiza nada — ni carga el script de Google.

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui";

/**
 * El botón de Google (widget de Google Identity Services, fuera de nuestro
 * control de estilos) se renderiza SIEMPRE con `theme: "outline"` — blanco
 * sólido — sin importar el tema de la app. Sobre una tarjeta negra (login en
 * modo oscuro) queda un bloque blanco fuera de lugar (reporte real de
 * Julieta, captura de /login en oscuro). Google sí soporta un tema oscuro
 * (`filled_black`); hay que elegirlo a mano según el modo RESUELTO (no sólo
 * la preferencia guardada: "sistema" depende del dispositivo en vivo).
 */
function useResolvedDarkMode(): boolean {
  const { theme } = useTheme();
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (theme === "dark") return true;
  if (theme === "light") return false;
  return systemPrefersDark;
}

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
  const isDark = useResolvedDarkMode();
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

  // El script de Google se carga UNA sola vez por sesión de navegador. Al
  // volver a /login (p. ej. después de cerrar sesión), `next/script` no vuelve
  // a disparar `onLoad` porque ya está cargado, así que `scriptReady` se
  // quedaba en `false` para siempre y el botón de Google NO se renderizaba
  // más: aparecía la primera vez y nunca más en esa pestaña. Si `window.google`
  // ya existe al montar, damos el script por listo sin esperar el `onLoad`.
  useEffect(() => {
    if (window.google) setScriptReady(true);
  }, []);

  useEffect(() => {
    if (!scriptReady || !GOOGLE_CLIENT_ID || !buttonHostRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        void handleCredential(response.credential);
      },
    });
    // Re-renderizar (no sólo inicializar) cada vez que cambia el modo
    // resuelto: `renderButton` no es reactivo a props, hay que llamarlo de
    // nuevo con el tema correcto. Se limpia el host antes para no duplicar
    // el botón (Google inyecta un iframe nuevo en cada llamada).
    buttonHostRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(buttonHostRef.current, {
      theme: isDark ? "filled_black" : "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      locale: "es",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, isDark]);

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
          <span className="bg-card px-2 text-ink/40">o continuá con</span>
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

      {error && <p className="mt-2 text-center text-sm text-danger-text">{error}</p>}
    </div>
  );
}
