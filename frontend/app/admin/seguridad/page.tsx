"use client";

// "Seguridad": la verificación en dos pasos de la cuenta admin (ADR-0023).
//
// Sin activar, es el alta: QR (o la clave a mano), el código de la app y los
// códigos de recuperación, que se muestran una sola vez. Es lo único que
// puede abrir una admin sin la verificación: el resto del panel le responde
// 403 y `AuthProvider` la trae acá.
//
// Activa: desde cuándo, cuántos códigos de recuperación le quedan, generar
// códigos nuevos y cambiar de celular (las dos piden un código actual).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatShiftDate } from "@/lib/datetime";
import { getErrorMessage } from "@/lib/errors";
import {
  formatSecret,
  isCompleteCode,
  sanitizeAppCode,
  TWO_FACTOR_CODES,
  twoFactorApi,
  type TwoFactorSetup,
  type TwoFactorStatus,
} from "@/lib/two-factor";
import { Button, Card, ErrorBanner, Skeleton, TextField } from "@/components/ui";
import { CheckIcon, CopyIcon, ShieldIcon, SmartphoneIcon } from "@/components/icons";
import { AdminHeading } from "@/components/admin/AdminStats";
import RecoveryCodesPanel from "@/components/admin/RecoveryCodesPanel";
import TotpQr from "@/components/admin/TotpQr";

type Phase =
  | { name: "loading" }
  | { name: "intro" }
  | { name: "scan"; setup: TwoFactorSetup; changingPhone: boolean }
  | { name: "codes"; codes: string[]; afterEnrollment: boolean; changingPhone: boolean }
  | { name: "active" };

const NOT_CONFIGURED_MESSAGE =
  "Falta configurar la clave del servidor (TWO_FACTOR_ENCRYPTION_KEY en Render). Sin ella no se puede activar.";

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.code === TWO_FACTOR_CODES.notConfigured) {
    return NOT_CONFIGURED_MESSAGE;
  }
  return getErrorMessage(err, fallback);
}

export default function AdminSecurityPage() {
  const { token, user, adoptSession, setTwoFactorSetupPending } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const s = await twoFactorApi.status(token);
      setStatus(s);
      setTwoFactorSetupPending(!s.enabled);
      setPhase(s.enabled ? { name: "active" } : { name: "intro" });
    } catch (err) {
      setError(messageFor(err, "No se pudo ver el estado de la verificación"));
    }
  }, [token, setTwoFactorSetupPending]);

  // Sólo al entrar: al activarla cambia el token (sesión nueva) pero el
  // estado ya se conoce, y recargar borraría los códigos en pantalla.
  useEffect(() => {
    if (token && status === null) void load();
  }, [token, status, load]);

  async function start(currentCode?: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const setup = await twoFactorApi.setup(token, currentCode);
      setPhase({ name: "scan", setup, changingPhone: Boolean(currentCode) });
    } catch (err) {
      setError(messageFor(err, "No se pudo empezar la activación"));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(code: string, changingPhone: boolean) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await twoFactorApi.confirm(token, code);
      // Sesión nueva, ya verificada: las demás de la cuenta se cerraron.
      await adoptSession(result);
      setStatus({
        enabled: true,
        enabled_at: status?.enabled_at ?? new Date().toISOString(),
        recovery_codes_left: result.recovery_codes.length,
      });
      setPhase({
        name: "codes",
        codes: result.recovery_codes,
        afterEnrollment: !changingPhone,
        changingPhone,
      });
    } catch (err) {
      setError(messageFor(err, "No se pudo verificar el código"));
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(code: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const { recovery_codes } = await twoFactorApi.regenerateCodes(token, code);
      setStatus((s) => (s ? { ...s, recovery_codes_left: recovery_codes.length } : s));
      setPhase({ name: "codes", codes: recovery_codes, afterEnrollment: false, changingPhone: false });
    } catch (err) {
      setError(messageFor(err, "No se pudieron generar códigos nuevos"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <AdminHeading
        title="Seguridad"
        subtitle="Verificación en dos pasos: además de la contraseña, un código de tu celular."
      />
      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} onRetry={phase.name === "loading" ? load : undefined} />
        </div>
      )}

      {phase.name === "loading" && !error && <Skeleton className="mt-5 h-48 w-full" />}

      {phase.name === "intro" && (
        <Card className="mt-5 p-5">
          <p className="text-sm text-ink/70">
            El panel de admin muestra datos de personas y sus documentos. Para entrar vas a usar tu
            contraseña y un código de 6 dígitos que cambia cada 30 segundos en una app
            autenticadora (Google Authenticator, Microsoft Authenticator, 1Password…).
          </p>
          <Button className="mt-4" fullWidth loading={busy} onClick={() => start()}>
            Activar la verificación
          </Button>
        </Card>
      )}

      {phase.name === "scan" && (
        <ScanStep
          setup={phase.setup}
          changingPhone={phase.changingPhone}
          busy={busy}
          onConfirm={(code) => confirm(code, phase.changingPhone)}
          onCancel={phase.changingPhone ? () => setPhase({ name: "active" }) : undefined}
        />
      )}

      {phase.name === "codes" && (
        <CodesStep
          codes={phase.codes}
          email={user?.email ?? ""}
          title={
            phase.afterEnrollment
              ? "Listo: la verificación está activa"
              : phase.changingPhone
                ? "Listo: tu celular nuevo quedó configurado"
                : "Códigos de recuperación nuevos"
          }
          doneLabel={phase.afterEnrollment ? "Ir al panel" : "Listo"}
          onDone={() =>
            phase.afterEnrollment ? router.replace("/admin") : setPhase({ name: "active" })
          }
        />
      )}

      {phase.name === "active" && status && (
        <ActiveStep status={status} busy={busy} onRegenerate={regenerate} onChangePhone={start} />
      )}
    </div>
  );
}

function ScanStep({
  setup,
  changingPhone,
  busy,
  onConfirm,
  onCancel,
}: {
  setup: TwoFactorSetup;
  changingPhone: boolean;
  busy: boolean;
  onConfirm: (code: string) => void;
  onCancel?: () => void;
}) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // La clave sigue a la vista para copiarla a mano.
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isCompleteCode(code, "app")) {
      setFieldError("Escribí los 6 dígitos que muestra la app.");
      return;
    }
    setFieldError(null);
    onConfirm(code);
  }

  return (
    <Card className="mt-5 p-5">
      <StepLabel n={1}>
        {changingPhone ? "En el celular nuevo, escaneá" : "Escaneá"} este código con tu app
        autenticadora.
      </StepLabel>
      <div className="mt-4 flex justify-center">
        <TotpQr value={setup.otpauth_uri} />
      </div>
      <p className="mt-4 text-sm text-ink/60">¿No podés escanearlo? Cargá esta clave a mano:</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-words rounded-xl bg-surface px-3 py-2.5 font-mono text-sm text-ink ring-1 ring-line">
          {formatSecret(setup.secret)}
        </code>
        <Button
          variant="surface"
          size="sm"
          onClick={copySecret}
          aria-label="Copiar la clave"
          leftIcon={copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        >
          {copied ? "Copiada" : "Copiar"}
        </Button>
      </div>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <StepLabel n={2}>Escribí el código de 6 dígitos que muestra la app.</StepLabel>
        <TextField
          label="Código de la app"
          name="one-time-code"
          autoComplete="one-time-code"
          inputMode="numeric"
          value={code}
          onChange={(v) => setCode(sanitizeAppCode(v))}
          placeholder="123456"
          maxLength={6}
          error={fieldError ?? undefined}
        />
        <Button type="submit" fullWidth loading={busy}>
          {changingPhone ? "Usar este celular" : "Activar"}
        </Button>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        )}
      </form>
    </Card>
  );
}

function CodesStep({
  codes,
  email,
  title,
  doneLabel,
  onDone,
}: {
  codes: string[];
  email: string;
  title: string;
  doneLabel: string;
  onDone: () => void;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <Card className="mt-5 p-5">
      <p className="flex items-center gap-2 font-display text-h3 font-semibold text-ink">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success-tint text-success-text">
          <CheckIcon size={16} />
        </span>
        {title}
      </p>
      <p className="mt-2 text-sm text-ink/70">
        Guardá estos códigos de recuperación fuera del celular. Si no lo tenés a mano, cada código
        te deja entrar una vez. <span className="font-semibold text-ink">No los vamos a volver a mostrar.</span>
      </p>
      <div className="mt-4">
        <RecoveryCodesPanel codes={codes} email={email} />
      </div>
      <label className="mt-5 flex items-start gap-2.5 text-sm text-ink/70">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-primary"
        />
        <span>Los guardé en un lugar seguro.</span>
      </label>
      <Button className="mt-4" fullWidth disabled={!saved} onClick={onDone}>
        {doneLabel}
      </Button>
    </Card>
  );
}

function ActiveStep({
  status,
  busy,
  onRegenerate,
  onChangePhone,
}: {
  status: TwoFactorStatus;
  busy: boolean;
  onRegenerate: (code: string) => void;
  onChangePhone: (code: string) => void;
}) {
  const [action, setAction] = useState<"codes" | "phone" | null>(null);
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const fewLeft = status.recovery_codes_left <= 3;

  function open(next: "codes" | "phone") {
    setAction(next);
    setCode("");
    setFieldError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!isCompleteCode(trimmed, "app") && !isCompleteCode(trimmed, "recovery")) {
      setFieldError("Escribí el código de la app o uno de recuperación.");
      return;
    }
    setFieldError(null);
    if (action === "codes") onRegenerate(trimmed);
    else onChangePhone(trimmed);
  }

  return (
    <>
      <Card className="mt-5 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-tint text-success-text">
            <ShieldIcon size={18} />
          </span>
          <div>
            <p className="font-semibold text-ink">Activa</p>
            <p className="text-sm text-ink/60">
              Desde el {status.enabled_at ? formatShiftDate(status.enabled_at) : "—"}.
            </p>
          </div>
        </div>
        <p
          className={
            fewLeft
              ? "mt-4 rounded-xl bg-warning-tint px-3.5 py-2.5 text-sm font-medium text-warning-text"
              : "mt-4 text-sm text-ink/70"
          }
        >
          Te quedan {status.recovery_codes_left} códigos de recuperación.
          {fewLeft && " Generá códigos nuevos."}
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="surface"
            size="sm"
            onClick={() => open("codes")}
            disabled={busy}
            className={action === "codes" ? "ring-2 ring-ink/40" : undefined}
          >
            Generar códigos nuevos
          </Button>
          <Button
            variant="surface"
            size="sm"
            onClick={() => open("phone")}
            disabled={busy}
            leftIcon={<SmartphoneIcon size={16} />}
            className={action === "phone" ? "ring-2 ring-ink/40" : undefined}
          >
            Cambiar de celular
          </Button>
        </div>
        {action && (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-ink/70">
              {action === "codes"
                ? "Los códigos anteriores dejan de servir."
                : "El celular actual deja de servir cuando confirmes el nuevo."}{" "}
              Para seguir, escribí el código de la app o uno de recuperación.
            </p>
            <TextField
              label="Código actual"
              name="current-code"
              autoComplete="one-time-code"
              value={code}
              onChange={setCode}
              placeholder="123456 o xxxx-xxxx-xxxx"
              maxLength={20}
              error={fieldError ?? undefined}
            />
            <Button type="submit" fullWidth loading={busy}>
              {action === "codes" ? "Generar códigos nuevos" : "Seguir"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAction(null)} disabled={busy}>
              Cancelar
            </Button>
          </form>
        )}
      </Card>
    </>
  );
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 text-sm font-semibold text-ink">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cielo-tint font-mono text-xs text-cielo-text">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </p>
  );
}
