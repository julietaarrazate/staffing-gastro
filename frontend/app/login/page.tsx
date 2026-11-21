"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { destinoTrasIngreso } from "@/lib/perfil-faltante";
import { api, ApiError, isAccountSuspended } from "@/lib/api";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import PantallaAcceso from "@/components/acceso/PantallaAcceso";
import { Button, TextField } from "@/components/ui";
import TurnstileWidget, { TurnstileTemprano } from "@/components/TurnstileWidget";
import TwoFactorLoginStep from "@/components/TwoFactorLoginStep";
import {
  bienvenidaHref,
  isLoginNotice,
  isSessionEndReason,
  LOGIN_NOTICES,
  registerHref,
  safeNext,
  SESSION_END_MESSAGES,
} from "@/lib/safe-next";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";

function LoginForm() {
  const { login, loginAsGuest, pendingTwoFactor } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Mensaje opcional tras un redirect (p. ej. `/restablecer` al terminar OK).
  // Texto fijo por aviso: lo que venga en la dirección y no esté en la lista
  // no se muestra.
  const aviso = searchParams.get("aviso");
  const infoMessage = isLoginNotice(aviso) ? LOGIN_NOTICES[aviso] : null;
  // La sesión terminó sola (`useRequireAuth` manda acá con el motivo): se
  // dice por qué, con un texto fijo por motivo, y al ingresar se vuelve a la
  // ruta en la que estaba la persona, si es una ruta interna.
  const motivo = searchParams.get("motivo");
  const endedMessage = isSessionEndReason(motivo) ? SESSION_END_MESSAGES[motivo] : null;
  const next = safeNext(searchParams.get("next"));
  const afterLogin = next ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // La contraseña era la correcta y la cuenta está suspendida (ADR-0024): se
  // dice con el mismo aviso que cuando la sesión termina por eso.
  const [suspended, setSuspended] = useState(false);
  const notice = suspended ? SESSION_END_MESSAGES.suspendida : endedMessage;
  const noticeIsSuspension = suspended || motivo === "suspendida";
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  // Acceso de invitado para la beta: un PIN (que configura la operadora en el
  // código) habilita entrar sin registrarse — así prueban sólo los que Julieta
  // quiere, no cualquiera. Reemplaza el login demo abierto anterior (que además
  // dependía del seed, ya apagado).
  const [pin, setPin] = useState("");
  const [guestLoading, setGuestLoading] = useState<"employer" | "worker" | null>(null);
  const [guestRole, setGuestRole] = useState<"employer" | "worker" | null>(null);
  // Con la beta abierta el PIN se vacía en Render (decisión 5) y el recuadro
  // desaparece: nadie ve un «Explorar sin cuenta» que pide un PIN que no
  // tiene. Arranca oculto (un usuario real no lo ve aparecer y desaparecer) y
  // sólo se muestra si el servidor dice que el acceso está prendido.
  const [guestEnabled, setGuestEnabled] = useState(false);
  useEffect(() => {
    let vigente = true;
    api
      .get<{ enabled: boolean }>("/auth/guest")
      .then((r) => vigente && setGuestEnabled(r.enabled === true))
      .catch(() => vigente && setGuestEnabled(false));
    return () => {
      vigente = false;
    };
  }, []);
  // Paso del código (admin con verificación en dos pasos). Queda abierto
  // aunque el desafío ya se haya canjeado: si entró con un código de
  // recuperación, el paso le avisa cuántos le quedan antes de seguir.
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  if (pendingTwoFactor && !twoFactorOpen) setTwoFactorOpen(true);

  async function doLogin(emailToUse: string, passwordToUse: string) {
    setError(null);
    setSuspended(false);
    const outcome = await login(emailToUse, passwordToUse);
    // Admin con la verificación en dos pasos: esta misma pantalla pasa a
    // pedir el código (`pendingTwoFactor`), sin sesión todavía.
    if (outcome.twoFactor) return;
    // `replace`: "atrás" tras entrar no debe volver a /login.
    router.replace(await destinoTrasIngreso(outcome.sesion, next));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await doLogin(email, password);
    } catch (err) {
      if (isAccountSuspended(err)) setSuspended(true);
      else setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
      // Cada token de Turnstile sirve una vez: tras un error, uno nuevo.
      setTurnstileReset((n) => n + 1);
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
      router.replace(bienvenidaHref(next));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo entrar como invitado"
      );
    } finally {
      setGuestLoading(null);
    }
  }

  return (
    <PantallaAcceso titulo="Ingresar" bajada="Entrá para ver tus turnos y mensajes.">
      {infoMessage && (
        <p className="mb-4 rounded-2xl bg-success-tint px-4 py-3 text-center text-sm font-medium text-success-text">
          {infoMessage}
        </p>
      )}

      {notice && (
        <p
          role={suspended ? "alert" : "status"}
          className={`mb-4 rounded-2xl px-4 py-3 text-center text-sm font-medium ${
            noticeIsSuspension ? "bg-warning-tint text-warning-text" : "bg-[var(--suave-campo)] text-ink"
          }`}
        >
          {notice}
        </p>
      )}

      {twoFactorOpen ? (
        <TwoFactorLoginStep
          afterLogin={afterLogin}
          onCancel={() => setTwoFactorOpen(false)}
          onExpired={(message) => {
            setTwoFactorOpen(false);
            setPassword("");
            setError(message);
            setTurnstileReset((n) => n + 1);
          }}
        />
      ) : (
        <>
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
            <TurnstileWidget resetKey={turnstileReset} onTokenChange={setTurnstileToken} />
            {error && <p className="text-sm text-danger-text">{error}</p>}
            <Button
              type="submit"
              fullWidth
              loading={submitting}
              disabled={Boolean(TURNSTILE_SITE_KEY) && !turnstileToken}
            >
              Ingresar
            </Button>
            <Link
              href="/recuperar"
              className="-mt-1 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary-text"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </form>

          <GoogleAuthButton
            onDone={async (isNewAccount, _rol, sesion) =>
              router.replace(isNewAccount ? bienvenidaHref(next) : await destinoTrasIngreso(sesion, next))
            }
          />

          {guestEnabled && (
            <div className="caja-suave mt-5 p-4">
              <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-soft">
                Explorar sin cuenta
              </p>
              {guestRole === null ? (
                <>
                  <p className="mt-2 text-center text-xs text-ink-soft">
                    Elegí cómo querés explorar la app.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Button
                      variant="surface"
                      size="sm"
                      fullWidth
                      className="boton-quieto"
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
                      className="boton-quieto"
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
                  <p className="mt-2 text-center text-xs text-ink-soft">
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
                      className="boton-quieto"
                      onClick={() => {
                        setError(null);
                        setGuestRole(null);
                      }}
                      disabled={guestLoading !== null}
                    >
                      Volver
                    </Button>
                    {/* Quieto: el único ámbar de la pantalla es «Ingresar». */}
                    <Button
                      type="submit"
                      variant="surface"
                      size="sm"
                      fullWidth
                      className="boton-quieto"
                      loading={guestLoading === guestRole}
                      disabled={guestLoading !== null}
                    >
                      Entrar
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          <p className="mt-5 text-center text-sm text-ink-soft">
            ¿No tenés cuenta?{" "}
            <Link href={registerHref({ next })} className="font-semibold text-primary-text">
              Creá una
            </Link>
          </p>
        </>
      )}
    </PantallaAcceso>
  );
}

export default function LoginPage() {
  return (
    <>
      <TurnstileTemprano />
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
