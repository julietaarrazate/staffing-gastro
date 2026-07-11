"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui";

const inputClass =
  "rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"worker" | "employer">("worker");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, fullName, role);
      router.push("/profile");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta");
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
        <h1 className="mt-4 text-center text-2xl font-bold text-zinc-900">Crear cuenta</h1>
        <p className="mt-1 text-center text-sm text-zinc-500">
          Empezá a cubrir o conseguir turnos en minutos.
        </p>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <div className="flex rounded-full bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setRole("worker")}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                role === "worker" ? "bg-orange-600 text-white" : "text-zinc-600"
              }`}
            >
              Soy trabajador/a
            </button>
            <button
              type="button"
              onClick={() => setRole("employer")}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                role === "employer" ? "bg-orange-600 text-white" : "text-zinc-600"
              }`}
            >
              Soy comercio
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <input
              required
              placeholder="Nombre completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
            />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Contraseña (mín. 8 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" fullWidth loading={submitting}>
              Crear cuenta
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-zinc-600">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-semibold text-orange-600">
            Ingresá
          </Link>
        </p>
      </div>
    </div>
  );
}
