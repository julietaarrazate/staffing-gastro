"use client";

// Segundo paso del login de una cuenta admin con la verificación en dos
// pasos (ADR-0023): la contraseña o Google ya pasaron y falta el código de
// la app autenticadora, o uno de recuperación si no tiene el celular.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { isCompleteCode, sanitizeAppCode, TWO_FACTOR_CODES, TWO_FACTOR_PAGE } from "@/lib/two-factor";
import { Button, TextField } from "@/components/ui";
import { ShieldIcon } from "@/components/icons";

export default function TwoFactorLoginStep({
  onExpired,
}: {
  /** El desafío venció o se usó: vuelve al formulario de la contraseña. */
  onExpired: (message: string) => void;
}) {
  const { completeTwoFactor, cancelTwoFactor } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"app" | "recovery">("app");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Entró con un código de recuperación: se le avisa cuántos le quedan antes
  // de seguir (si perdió el celular, tiene que configurar uno nuevo).
  const [recoveryLeft, setRecoveryLeft] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isCompleteCode(code, mode)) {
      setError(
        mode === "app"
          ? "Escribí los 6 dígitos que muestra la app."
          : "Escribí el código de recuperación completo."
      );
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await completeTwoFactor(code);
      if (result.used_recovery_code) {
        setRecoveryLeft(result.recovery_codes_left);
      } else {
        router.replace("/");
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === TWO_FACTOR_CODES.challengeInvalid) {
        onExpired(err.message);
        return;
      }
      setError(getErrorMessage(err, "No se pudo verificar el código"));
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setMode((m) => (m === "app" ? "recovery" : "app"));
    setCode("");
    setError(null);
  }

  if (recoveryLeft !== null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink/70">
          Entraste con un código de recuperación. Te quedan{" "}
          <span className="font-semibold text-ink">{recoveryLeft}</span>.
        </p>
        <p className="text-sm text-ink/70">
          Si perdiste el celular, configurá uno nuevo en Seguridad.
        </p>
        <Button fullWidth onClick={() => router.replace(TWO_FACTOR_PAGE)}>
          Ir a Seguridad
        </Button>
        <Button variant="ghost" fullWidth onClick={() => router.replace("/")}>
          Seguir al panel
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cielo-tint text-cielo-text">
          <ShieldIcon size={18} />
        </span>
        <div>
          <h2 className="font-display text-h3 font-semibold text-ink">Verificación en dos pasos</h2>
          <p className="mt-0.5 text-sm text-ink/60">
            {mode === "app"
              ? "Escribí el código de 6 dígitos que muestra tu app autenticadora."
              : "Escribí uno de tus códigos de recuperación. Cada uno sirve una vez."}
          </p>
        </div>
      </div>
      {mode === "app" ? (
        <TextField
          key="app"
          label="Código de la app"
          name="one-time-code"
          autoComplete="one-time-code"
          inputMode="numeric"
          value={code}
          onChange={(v) => setCode(sanitizeAppCode(v))}
          placeholder="123456"
          maxLength={6}
          error={error ?? undefined}
        />
      ) : (
        <TextField
          key="recovery"
          label="Código de recuperación"
          name="recovery-code"
          autoComplete="off"
          value={code}
          onChange={setCode}
          placeholder="xxxx-xxxx-xxxx"
          maxLength={20}
          error={error ?? undefined}
        />
      )}
      <Button type="submit" fullWidth loading={submitting}>
        Verificar
      </Button>
      <button
        type="button"
        onClick={switchMode}
        className="text-center text-sm font-semibold text-primary-text"
      >
        {mode === "app" ? "No tengo el celular: usar un código de recuperación" : "Usar el código de la app"}
      </button>
      <Button variant="ghost" size="sm" onClick={cancelTwoFactor}>
        Volver
      </Button>
    </form>
  );
}
