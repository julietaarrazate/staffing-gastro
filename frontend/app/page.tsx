"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import Logo from "@/components/Logo";

// Home de cada rol: a dónde mandamos a un usuario ya logueado. La landing es
// sólo para visitantes sin sesión; quien ya entró va directo a su app.
const HOME_BY_ROLE: Record<string, string> = {
  worker: "/feed",
  employer: "/shifts",
  admin: "/admin",
};

/**
 * Landing: una sola pantalla que arranca el flujo.
 *
 * Antes era una landing larga de marketing: hero + cinta de puestos + stats +
 * timeline "cómo funciona" + bento de 5 tarjetas con ícono + CTA final. Ese
 * patrón —la grilla de features con iconito— es el cliché visual que hacía que
 * la app "se sintiera hecha por IA": prolija, pero igual a cualquier otra.
 *
 * El cambio de criterio (referencia: Pasito) es que la primera pantalla **no
 * explica el producto, lo empieza**. Quien llega ya sabe lo que necesita
 * (personal o trabajo); lo único que tiene que hacer la landing es dejarlo
 * elegir de qué lado está y sacarlo de acá en un toque.
 *
 * Fondo ink de marca con el naranja como único acento: es el momento en que la
 * app se presenta, y en claro se veía igual a cualquier plantilla.
 */
export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!loading && user) {
      router.replace(HOME_BY_ROLE[user.role] ?? "/feed");
    }
  }, [loading, user, router]);

  // Sólo se oculta cuando YA sabemos que hay sesión. No se bloquea por
  // `loading`: esta ruta se prerenderiza estática y ahí `loading` arranca en
  // `true`, así que bloquear dejaría el HTML estático VACÍO y el visitante
  // vería blanco hasta que hidrate el cliente.
  if (user) return null;

  return (
    <div className="-mb-20 flex min-h-[100dvh] flex-col bg-ink px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[calc(env(safe-area-inset-top)+2.5rem)] text-white md:mb-0">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
        // `.no-select`: es chrome de vitrina, no texto de lectura.
        className="no-select mx-auto flex w-full max-w-sm flex-1 flex-col"
      >
        <Logo size={40} withWordmark={false} />

        <h1 className="mt-10 text-[2.75rem] font-extrabold leading-[1.05] tracking-tight">
          Personal gastronómico,{" "}
          <span className="text-primary">ya</span>.
        </h1>

        <p className="mt-4 text-lg leading-relaxed text-white/60">
          Publicás un turno y en minutos tenés candidatos cerca tuyo, ordenados
          por reputación.
        </p>

        {/* El centro de la pantalla es la elección de lado, no una lista de
            features: quien llega ya sabe qué necesita. */}
        <div className="mt-auto flex flex-col gap-3 pt-12">
          <Link
            href="/register?rol=comercio"
            className="flex min-h-[56px] items-center justify-center rounded-[var(--radius-btn)] bg-primary px-6 text-[17px] font-bold text-white transition active:scale-[0.98]"
          >
            Necesito personal
          </Link>
          <Link
            href="/register?rol=trabajador"
            className="flex min-h-[56px] items-center justify-center rounded-[var(--radius-btn)] bg-white/10 px-6 text-[17px] font-bold text-white ring-1 ring-white/15 transition active:scale-[0.98]"
          >
            Quiero trabajar
          </Link>
          <Link
            href="/login"
            className="mt-2 py-2 text-center text-[15px] font-semibold text-white/60"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
