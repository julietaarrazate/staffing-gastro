"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

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
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Crear cuenta</h1>

      <div className="mt-6 flex rounded-full bg-zinc-100 p-1">
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

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input
          required
          placeholder="Nombre completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Contraseña (mín. 8 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {submitting ? "Creando..." : "Crear cuenta"}
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-600">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-orange-600">
          Ingresá
        </Link>
      </p>
    </div>
  );
}
