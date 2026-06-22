"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import Logo from "@/components/Logo";

const inputClass =
  "rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
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
        <h1 className="mt-4 text-center text-2xl font-bold text-zinc-900">Ingresar</h1>
        <p className="mt-1 text-center text-sm text-zinc-500">
          Entrá para ver tus turnos y mensajes.
        </p>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-orange-600 px-4 py-2.5 font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-zinc-600">
          ¿No tenés cuenta?{" "}
          <Link href="/register" className="font-semibold text-orange-600">
            Creá una
          </Link>
        </p>
      </div>
    </div>
  );
}
