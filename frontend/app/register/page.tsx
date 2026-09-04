"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import Logo from "@/components/Logo";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { Button, SegmentedControl, TextField } from "@/components/ui";

type Role = "worker" | "employer";

/** `?rol=comercio|trabajador` en la URL preselecciona la pestaña — lo usan
 * los CTA de la landing ("Necesito personal" / "Quiero trabajar", ver
 * `app/page.tsx`) para no hacer elegir dos veces al visitante. */
function roleFromQuery(value: string | null): Role | null {
  if (value === "comercio") return "employer";
  if (value === "trabajador") return "worker";
  return null;
}

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(() => roleFromQuery(searchParams.get("rol")) ?? "worker");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, fullName, role);
      // `replace` para no volver a /register al ir "atrás". Los dos roles pasan
      // por el onboarding de `/bienvenida` (zona+oficio para el trabajador,
      // nombre+ubicación para el comercio) — ese componente decide qué mostrar
      // según `user.role`.
      router.replace("/bienvenida");
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
        <h1 className="mt-4 text-center font-display text-h1 font-semibold tracking-tight text-ink">Crear cuenta</h1>
        <p className="mt-1 text-center text-sm text-ink/50">
          Empezá a cubrir o conseguir turnos en minutos.
        </p>

        <div className="mt-6 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)] ring-1 ring-line">
          <SegmentedControl
            options={[
              { value: "worker", label: "Soy trabajador/a" },
              { value: "employer", label: "Soy comercio" },
            ]}
            value={role}
            onChange={setRole}
          />

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <TextField
              label="Nombre completo"
              name="name"
              autoComplete="name"
              value={fullName}
              onChange={setFullName}
              placeholder="Nombre completo"
              required
            />
            <TextField
              type="email"
              name="email"
              autoComplete="email"
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="Email"
              required
            />
            <TextField
              type="password"
              name="new-password"
              autoComplete="new-password"
              label="Contraseña"
              value={password}
              onChange={setPassword}
              placeholder="Contraseña (mín. 8 caracteres)"
              required
              minLength={8}
            />
            <label className="flex items-start gap-2.5 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-primary focus:ring-primary"
              />
              <span>
                Acepto los{" "}
                <Link
                  href="/terminos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary-text hover:underline"
                >
                  Términos y Condiciones
                </Link>{" "}
                y la{" "}
                <Link
                  href="/privacidad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary-text hover:underline"
                >
                  Política de Privacidad
                </Link>
              </span>
            </label>
            {error && (
              <p role="alert" className="text-sm text-danger-text">
                {error}
              </p>
            )}
            <Button type="submit" fullWidth loading={submitting} disabled={!acceptedTerms}>
              Crear cuenta
            </Button>
          </form>

          {/* Cuenta nueva por Google → onboarding. `/bienvenida` reenvía solo
              al comercio a su panel, así que no hace falta saber el rol acá
              (lo elige el usuario dentro del propio botón de Google). */}
          <GoogleAuthButton onDone={(isNewAccount) => router.replace(isNewAccount ? "/bienvenida" : "/")} />
        </div>

        <p className="mt-5 text-center text-sm text-ink/70">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-semibold text-primary-text">
            Ingresá
          </Link>
        </p>
        {/* La recuperación existía (`/recuperar`) pero sólo se llegaba desde
            /login: quien intentaba registrarse con un email ya usado quedaba
            sin salida visible. */}
        <p className="mt-2 text-center text-sm text-ink/50">
          ¿Olvidaste tu contraseña?{" "}
          <Link href="/recuperar" className="font-semibold text-primary-text">
            Recuperala
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
