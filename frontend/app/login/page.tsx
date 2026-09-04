"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import Logo from "@/components/Logo";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { Button, TextField } from "@/components/ui";

function LoginForm() {
  const { login, loginAsGuest } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Mensaje opcional tras un redirect (p. ej. `/restablecer` al terminar OK).
  const infoMessage = searchParams.get("message");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Acceso de invitado para la beta: un PIN (que configura la operadora en el
  // código) habilita entrar sin registrarse — así prueban sólo los que Julieta
  // quiere, no cualquiera. Reemplaza el login demo abierto anterior (que además
  // dependía del seed, ya apagado).
  const [pin, setPin] = useState("");
  const [guestLoading, setGuestLoading] = useState<"employer" | "worker" | null>(null);
  const [guestRole, setGuestRole] = useState<"employer" | "worker" | null>(null);

  async function doLogin(emailToUse: string, passwordToUse: string) {
    setError(null);
    await login(emailToUse, passwordToUse);
    // `replace`: "atrás" tras entrar no debe volver a /login.
    router.replace("/");
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

  async function handleGuestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestRole) return;
    if (!pin.trim()) {
      setError("Ingresá el PIN para explorar sin cuenta.");
      return;
    }
    setError(null);
    setGuestLoading(guestRole);
    try {
      await loginAsGuest(pin.trim(), guestRole);
      // Mismo onboarding que vería un usuario real recién registrado
      // (`/bienvenida`, C4): el invitado prueba la app desde cero, no
      // arranca ya adentro del panel. Va a la cuenta invitado compartida,
      // consistente con que su exploración ya es de por sí compartida.
      router.replace("/bienvenida");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo entrar como invitado"
      );
    } finally {
      setGuestLoading(null);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size={48} withWordmark={false} />
        </div>
        <h1 className="mt-4 text-center font-display text-h1 font-semibold tracking-tight text-ink">Ingresar</h1>
        <p className="mt-1 text-center text-sm text-ink/50">
          Entrá para ver tus turnos y mensajes.
        </p>

        {infoMessage && (
          <p className="mt-4 rounded-xl bg-success-tint px-3.5 py-2.5 text-center text-sm font-medium text-success-text">
            {infoMessage}
          </p>
        )}

        <div className="mt-6 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)] ring-1 ring-line">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              name="password"
              autoComplete="current-password"
              label="Contraseña"
              value={password}
              onChange={setPassword}
              placeholder="Contraseña"
              required
            />
            {error && <p className="text-sm text-danger-text">{error}</p>}
            <Button type="submit" fullWidth loading={submitting}>
              Ingresar
            </Button>
            <Link
              href="/recuperar"
              className="text-center text-sm font-semibold text-primary-text"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </form>

          <GoogleAuthButton onDone={(isNewAccount) => router.replace(isNewAccount ? "/bienvenida" : "/")} />
        </div>

        <div className="mt-5 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
          <p className="text-center text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">
            Explorar sin cuenta
          </p>
          {guestRole === null ? (
            <>
              <p className="mt-2 text-center text-xs text-ink/50">
                Elegí cómo querés explorar la app.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button
                  variant="surface"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setError(null);
                    setGuestRole("employer");
                  }}
                >
                  Soy comercio
                </Button>
                <Button
                  variant="surface"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setError(null);
                    setGuestRole("worker");
                  }}
                >
                  Soy trabajador
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={handleGuestSubmit}>
              <p className="mt-2 text-center text-xs text-ink/50">
                Con el PIN de la beta entrás a probar la app como{" "}
                {guestRole === "employer" ? "comercio" : "trabajador"}.
              </p>
              <div className="mt-3">
                <TextField
                  label="PIN de acceso"
                  name="pin"
                  autoComplete="off"
                  value={pin}
                  onChange={setPin}
                  placeholder="Ingresá el PIN"
                  inputMode="numeric"
                />
              </div>
              <div className="mt-3 flex gap-3">
                <Button
                  type="button"
                  variant="surface"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    setGuestRole(null);
                  }}
                  disabled={guestLoading !== null}
                >
                  Volver
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  fullWidth
                  loading={guestLoading === guestRole}
                  disabled={guestLoading !== null}
                >
                  Entrar
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-ink/70">
          ¿No tenés cuenta?{" "}
          <Link href="/register" className="font-semibold text-primary-text">
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
