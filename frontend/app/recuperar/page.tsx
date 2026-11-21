"use client";

import { useState } from "react";
import Link from "next/link";
import { api, isRateLimited, RATE_LIMITED_MESSAGE } from "@/lib/api";
import { Button, TextField } from "@/components/ui";
import PantallaAcceso from "@/components/acceso/PantallaAcceso";

// Mensaje anti-enumeración: siempre el mismo, exista o no el email (no
// revela si hay o no una cuenta con ese mail). El backend responde 202
// siempre por el mismo motivo (`POST /auth/forgot-password`).
const GENERIC_MESSAGE = "Si el mail existe, te enviamos un enlace para restablecer tu contraseña.";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [limited, setLimited] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLimited(false);
    let sentOk = true;
    try {
      await api.post("/auth/forgot-password", { email });
    } catch (err) {
      // El límite de intentos es por conexión y no dice nada del mail: se
      // avisa y el formulario queda para reintentar. Cualquier otro error,
      // aunque falle la red, muestra el mismo mensaje genérico para no
      // revelar nada sobre el estado de la cuenta.
      if (isRateLimited(err)) {
        sentOk = false;
        setLimited(true);
      }
    } finally {
      setSubmitting(false);
      if (sentOk) setSent(true);
    }
  }

  return (
    <PantallaAcceso titulo="Recuperar contraseña" bajada="Te mandamos un enlace a tu email para elegir una nueva.">
      {sent ? (
        <p className="rounded-2xl bg-success-tint px-4 py-3 text-center text-sm font-medium text-success-text">
          {GENERIC_MESSAGE}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            type="email"
            name="email"
            autoComplete="email"
            label="Email"
            required
            placeholder="Email"
            value={email}
            onChange={setEmail}
          />
          {limited && (
            <p role="alert" className="text-sm text-danger-text">
              {RATE_LIMITED_MESSAGE}
            </p>
          )}
          <Button type="submit" fullWidth loading={submitting}>
            Enviar enlace
          </Button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-ink-soft">
        <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-primary-text">
          Volver a ingresar
        </Link>
      </p>
    </PantallaAcceso>
  );
}
