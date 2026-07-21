"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import Logo from "@/components/Logo";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { Button, TextField } from "@/components/ui";

// Cuentas demo seedeadas por backend/scripts/seed_demo_data.py. Sirven para
// probar la app sin crear cuenta ni recordar credenciales (datos ficticios).
const DEMO_PASSWORD = "staffyaDemo123";
const DEMO_EMPLOYER = "demo.palermo@staffya.com";
const DEMO_WORKER = "demo.mozo.palermo@staffya.com";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Mensaje opcional tras un redirect (p. ej. `/restablecer` al terminar OK).
  const infoMessage = searchParams.get("message");
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
        <h1 className="mt-4 text-center text-2xl font-extrabold tracking-tight text-ink">Ingresar</h1>
        <p className="mt-1 text-center text-sm text-ink/50">
          Entrá para ver tus turnos y mensajes.
        </p>

        {infoMessage && (
          <p className="mt-4 rounded-xl bg-green-50 px-3.5 py-2.5 text-center text-sm font-medium text-green-700">
            {infoMessage}
          </p>
        )}

        <div className="mt-6 rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-line">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField
              type="email"
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="Email"
              required
            />
            <TextField
              type="password"
              label="Contraseña"
              value={password}
              onChange={setPassword}
              placeholder="Contraseña"
              required
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" fullWidth loading={submitting}>
              Ingresar
            </Button>
            <Link
              href="/recuperar"
              className="text-center text-sm font-semibold text-primary"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </form>

          <GoogleAuthButton onDone={(isNewAccount) => router.push(isNewAccount ? "/profile" : "/")} />
        </div>

        <div className="mt-5 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Probar la app sin cuenta
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button
              variant="surface"
              size="sm"
              fullWidth
              onClick={() => handleDemo("employer")}
              loading={demoLoading === "employer"}
              disabled={demoLoading !== null}
            >
              Soy comercio
            </Button>
            <Button
              variant="surface"
              size="sm"
              fullWidth
              onClick={() => handleDemo("worker")}
              loading={demoLoading === "worker"}
              disabled={demoLoading !== null}
            >
              Soy trabajador
            </Button>
          </div>
          <p className="mt-2.5 text-center text-xs text-zinc-400">
            Entrás con un perfil de demostración para ver la app.
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-ink/70">
          ¿No tenés cuenta?{" "}
          <Link href="/register" className="font-semibold text-primary">
            Creá una
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
