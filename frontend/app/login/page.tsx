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

// Cuentas demo seedeadas por backend/scripts/seed_demo_data.py. Sirven para
// probar la app sin crear cuenta ni recordar credenciales (datos ficticios).
const DEMO_PASSWORD = "staffyaDemo123";
const DEMO_EMPLOYER = "demo.palermo@staffya.com";
const DEMO_WORKER = "demo.mozo.palermo@staffya.com";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState<"employer" | "worker" | null>(null);

  async function doLogin(emailToUse: string, passwordToUse: string) {
    setError(null);
    await login(emailToUse, passwordToUse);
    router.push("/");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await doLogin(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemo(role: "employer" | "worker") {
    setDemoLoading(role);
    try {
      await doLogin(role === "employer" ? DEMO_EMPLOYER : DEMO_WORKER, DEMO_PASSWORD);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo entrar con la cuenta de prueba"
      );
    } finally {
      setDemoLoading(null);
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
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </div>

        <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Probar la app sin cuenta
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleDemo("employer")}
              disabled={demoLoading !== null}
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm font-semibold text-zinc-700 transition active:scale-95 hover:bg-zinc-200 disabled:opacity-50"
            >
              {demoLoading === "employer" ? "Entrando..." : "Soy comercio"}
            </button>
            <button
              type="button"
              onClick={() => handleDemo("worker")}
              disabled={demoLoading !== null}
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm font-semibold text-zinc-700 transition active:scale-95 hover:bg-zinc-200 disabled:opacity-50"
            >
              {demoLoading === "worker" ? "Entrando..." : "Soy trabajador"}
            </button>
          </div>
          <p className="mt-2.5 text-center text-xs text-zinc-400">
            Entrás con un perfil de demostración para ver la app.
          </p>
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
