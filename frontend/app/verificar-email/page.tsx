"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, isRateLimited, RATE_LIMITED_MESSAGE } from "@/lib/api";
import { Button, TextField } from "@/components/ui";
import PantallaAcceso from "@/components/acceso/PantallaAcceso";
import { useAuth } from "@/lib/auth-context";
import { homeDelRol } from "@/lib/home-del-rol";

type Status = "verifying" | "success" | "error" | "no-token";

function VerificarEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  // Con sesión abierta, "Ingresar" no tiene sentido: va al inicio del rol (U042).
  const { user } = useAuth();
  const destino = user ? homeDelRol(user.role) : "/login";
  const [status, setStatus] = useState<Status>(token ? "verifying" : "no-token");
  const [resendEmail, setResendEmail] = useState("");
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [limited, setLimited] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;
    api
      .post("/auth/verify-email", { token })
      .then(() => setStatus("success"))
      .catch((err) => {
        if (isRateLimited(err)) setLimited(true);
        setStatus("error");
      });
  }, [token]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResendSubmitting(true);
    setLimited(false);
    let sentOk = true;
    try {
      await api.post("/auth/resend-verification", { email: resendEmail });
    } catch (err) {
      // Anti-enumeración: sólo el límite de intentos se distingue (es por
      // conexión); el resto, mismo criterio que /recuperar.
      if (isRateLimited(err)) {
        sentOk = false;
        setLimited(true);
      }
    } finally {
      setResendSubmitting(false);
      if (sentOk) setResendSent(true);
    }
  }

  return (
    <PantallaAcceso titulo="Confirmá tu email">
      {status === "verifying" && (
        <p className="text-center text-sm text-ink-soft">Confirmando tu email…</p>
      )}

      {status === "success" && (
        <div className="text-center">
          <p className="rounded-2xl bg-success-tint px-4 py-3 text-sm font-medium text-success-text">
            Listo, tu email quedó confirmado.
          </p>
          <Link href={destino} className="mt-4 block">
            <Button type="button" fullWidth>
              {user ? "Ir al inicio" : "Ingresar"}
            </Button>
          </Link>
        </div>
      )}

      {status === "no-token" && (
        <p className="text-sm text-danger-text">El enlace es inválido o le falta el token.</p>
      )}

      {status === "error" && (
        <div>
          <p role="alert" className="text-sm text-danger-text">
            {limited ? RATE_LIMITED_MESSAGE : "El enlace es inválido o venció. Pedí uno nuevo con tu email."}
          </p>
          {resendSent ? (
            <p className="mt-4 rounded-2xl bg-success-tint px-4 py-3 text-center text-sm font-medium text-success-text">
              Si corresponde, te mandamos un enlace. Si pediste uno hace poco, esperá unos minutos y revisá la carpeta de spam.
            </p>
          ) : (
            <form onSubmit={handleResend} className="mt-4 flex flex-col gap-4">
              <TextField
                type="email"
                label="Email"
                required
                placeholder="Email"
                value={resendEmail}
                onChange={setResendEmail}
              />
              <Button type="submit" fullWidth loading={resendSubmitting}>
                Reenviar enlace
              </Button>
            </form>
          )}
        </div>
      )}

      <p className="mt-5 text-center text-sm text-ink-soft">
        <Link href={destino} className="inline-flex min-h-11 items-center font-semibold text-primary-text">
          {user ? "Volver al inicio" : "Volver a ingresar"}
        </Link>
      </p>
    </PantallaAcceso>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense>
      <VerificarEmailContent />
    </Suspense>
  );
}
