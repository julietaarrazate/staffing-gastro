"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui";

const inputClass =
  "rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-orange-100";

type Status = "verifying" | "success" | "error" | "no-token";

function VerificarEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "no-token");
  const [resendEmail, setResendEmail] = useState("");
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;
    api
      .post("/auth/verify-email", { token })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResendSubmitting(true);
    try {
      await api.post("/auth/resend-verification", { email: resendEmail });
    } catch {
      // Anti-enumeración: no distinguimos el resultado, mismo criterio que /recuperar.
    } finally {
      setResendSubmitting(false);
      setResendSent(true);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size={48} withWordmark={false} />
        </div>
        <h1 className="mt-4 text-center font-display text-2xl font-semibold text-ink">
          Confirmá tu email
        </h1>

        <div className="mt-6 rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-line">
          {status === "verifying" && (
            <p className="text-center text-sm text-ink/60">Confirmando tu email…</p>
          )}

          {status === "success" && (
            <div className="text-center">
              <p className="text-sm font-medium text-success-text">
                Listo, tu email quedó confirmado.
              </p>
              <Link href="/login" className="mt-4 inline-block">
                <Button type="button">Ingresar</Button>
              </Link>
            </div>
          )}

          {status === "no-token" && (
            <p className="text-sm text-danger-text">
              El enlace es inválido o le falta el token.
            </p>
          )}

          {status === "error" && (
            <div>
              <p className="text-sm text-danger-text">
                El enlace es inválido o venció. Pedí uno nuevo con tu email.
              </p>
              {resendSent ? (
                <p className="mt-4 text-center text-sm font-medium text-success-text">
                  Si el email existe y todavía no está verificado, te enviamos un enlace.
                </p>
              ) : (
                <form onSubmit={handleResend} className="mt-4 flex flex-col gap-3">
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className={inputClass}
                  />
                  <Button type="submit" fullWidth loading={resendSubmitting}>
                    Reenviar enlace
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-ink/60">
          <Link href="/login" className="font-semibold text-primary-text">
            Volver a ingresar
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense>
      <VerificarEmailContent />
    </Suspense>
  );
}
