"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { loginHref } from "@/lib/safe-next";
import { Button, TextField } from "@/components/ui";
import PantallaAcceso from "@/components/acceso/PantallaAcceso";

function RestablecerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("El enlace es inválido. Pedí uno nuevo desde 'Olvidaste tu contraseña'.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      router.push(loginHref({ aviso: "clave-actualizada" }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restablecer la contraseña");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PantallaAcceso titulo="Elegí una nueva contraseña" bajada="Escribila dos veces para confirmar.">
      {!token ? (
        <p className="text-sm text-danger-text">
          El enlace es inválido o le falta el token. Pedí uno nuevo desde{" "}
          <Link href="/recuperar" className="font-semibold text-primary-text">
            recuperar contraseña
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            type="password"
            name="new-password"
            autoComplete="new-password"
            label="Nueva contraseña"
            required
            minLength={8}
            placeholder="Mín. 8 caracteres"
            value={password}
            onChange={setPassword}
          />
          <TextField
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            label="Confirmá la nueva contraseña"
            required
            minLength={8}
            placeholder="Repetí la contraseña"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          {error && <p className="text-sm text-danger-text">{error}</p>}
          <Button type="submit" fullWidth loading={submitting}>
            Restablecer contraseña
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

export default function RestablecerPage() {
  return (
    <Suspense>
      <RestablecerForm />
    </Suspense>
  );
}
