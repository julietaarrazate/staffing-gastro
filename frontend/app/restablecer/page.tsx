"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import Logo from "@/components/Logo";
import { Button, TextField } from "@/components/ui";

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
      router.push("/login?message=" + encodeURIComponent("Contraseña actualizada. Ingresá con tu nueva contraseña."));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restablecer la contraseña");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size={48} withWordmark={false} />
        </div>
        <h1 className="mt-4 text-center font-display text-2xl font-semibold text-ink">
          Elegí una nueva contraseña
        </h1>
        <p className="mt-1 text-center text-sm text-ink/50">
          Escribila dos veces para confirmar.
        </p>

        <div className="mt-6 rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-line">
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
                label="Nueva contraseña"
                required
                minLength={8}
                placeholder="Mín. 8 caracteres"
                value={password}
                onChange={setPassword}
              />
              <TextField
                type="password"
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

export default function RestablecerPage() {
  return (
    <Suspense>
      <RestablecerForm />
    </Suspense>
  );
}
