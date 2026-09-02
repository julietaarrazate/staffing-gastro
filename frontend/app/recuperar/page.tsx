"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Logo from "@/components/Logo";
import { Button, TextField } from "@/components/ui";

// Mensaje anti-enumeración: siempre el mismo, exista o no el email (no
// revela si hay o no una cuenta con ese mail). El backend responde 202
// siempre por el mismo motivo (`POST /auth/forgot-password`).
const GENERIC_MESSAGE = "Si el mail existe, te enviamos un enlace para restablecer tu contraseña.";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } catch {
      // Aunque falle la red, no distinguimos el caso: mostramos el mismo
      // mensaje genérico para no revelar nada sobre el estado de la cuenta.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size={48} withWordmark={false} />
        </div>
        <h1 className="mt-4 text-center font-display text-h1 font-semibold text-ink">
          Recuperar contraseña
        </h1>
        <p className="mt-1 text-center text-sm text-ink/50">
          Te mandamos un enlace a tu email para elegir una nueva.
        </p>

        <div className="mt-6 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)] ring-1 ring-line">
          {sent ? (
            <p className="text-center text-sm font-medium text-success-text">
              {GENERIC_MESSAGE}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <TextField
                type="email"
                label="Email"
                required
                placeholder="Email"
                value={email}
                onChange={setEmail}
              />
              <Button type="submit" fullWidth loading={submitting}>
                Enviar enlace
              </Button>
            </form>
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
