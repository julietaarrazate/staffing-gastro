"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentType } from "react";
import { useAuth } from "@/lib/auth-context";
import Reveal from "@/components/landing/Reveal";
import ScrollHeroShowcase from "@/components/landing/ScrollHeroShowcase";

// Secciones por debajo del fold: se cargan en chunks aparte (`next/dynamic`)
// para no engordar el bundle inicial y que el hero pinte antes (menos pantalla
// en blanco al abrir). Se siguen renderizando en el servidor (`ssr` default),
// así que el contenido/SEO no cambia; sólo se difiere su JS de cliente.
const PositionsMarquee = dynamic(() => import("@/components/landing/PositionsMarquee"));
const StatsStrip = dynamic(() => import("@/components/landing/StatsStrip"));
const HowItWorksTimeline = dynamic(() => import("@/components/landing/HowItWorksTimeline"));
const ParallaxCard = dynamic(() => import("@/components/landing/ParallaxCard"));
import {
  BellIcon,
  type IconProps,
  MapPinIcon,
  MessageIcon,
  ShareIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/icons";

type Feature = {
  Icon: ComponentType<IconProps>;
  title: string;
  text: string;
};

const HERO_FEATURE: Feature = {
  Icon: SparklesIcon,
  title: "Candidatos en minutos",
  text: "Publicás el turno y en minutos tenés una lista rankeada por cercanía y reputación, lista para asignar.",
};

const FEATURES: Feature[] = [
  {
    Icon: MapPinIcon,
    title: "Asistencia con GPS",
    text: "Check-in y check-out geolocalizado para saber que todo salió bien.",
  },
  {
    Icon: MessageIcon,
    title: "Chat integrado",
    text: "Coordiná los detalles de cada turno sin salir de la app.",
  },
  {
    Icon: StarIcon,
    title: "Reputación",
    text: "Rating, puntualidad e historial para elegir con confianza.",
  },
  {
    Icon: BellIcon,
    title: "Doble reserva imposible",
    text: "El sistema bloquea solapamientos: nadie queda comprometido en dos turnos a la vez.",
  },
  {
    Icon: ShareIcon,
    title: "Compartí por WhatsApp",
    text: "Mandá un turno abierto por WhatsApp con un link, sin salir de la app.",
  },
];

// Velocidades de parallax por tarjeta del bento (px de recorrido, sutil):
// distintas entre sí para que el conjunto se sienta con profundidad, no como
// un bloque único que sube y baja parejo.
const PARALLAX_RANGES = [10, 16, 10, 18, 12, 14];

// Home de cada rol: a dónde mandamos a un usuario ya logueado. La landing es
// marketing (para visitantes sin sesión); quien ya entró va directo a su app.
const HOME_BY_ROLE: Record<string, string> = {
  worker: "/feed",
  employer: "/shifts",
  admin: "/admin",
};

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  // Si ya hay sesión, no mostramos la landing de marketing: redirigimos a la
  // home del rol. La landing queda sólo para visitantes sin cuenta.
  useEffect(() => {
    if (!loading && user) {
      router.replace(HOME_BY_ROLE[user.role] ?? "/feed");
    }
  }, [loading, user, router]);

  // Sólo ocultamos la landing cuando YA sabemos que hay sesión (redirigiendo a
  // la home del rol). Antes se ocultaba también mientras `loading` — pero como
  // esta ruta se prerenderiza estática y en el prerender `loading` arranca en
  // `true`, el HTML estático salía VACÍO: el visitante veía blanco hasta que el
  // cliente hidrataba y verificaba sesión. Al no bloquear por `loading`, el
  // contenido de marketing queda en el HTML estático y pinta al instante; el
  // usuario logueado igual se va por el `useEffect` de arriba (un parpadeo
  // breve del landing es preferible a un blanco para todos los visitantes).
  if (user) return null;

  return (
    <div className="overflow-x-clip">
      {/* Hero: papel cálido, un solo acento naranja */}
      <section className="bg-paper">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-14 sm:pt-20">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
            // `.no-select` (regla C0, docs/PULIDO_ROADMAP.md fix 2): título,
            // tagline y badge de marketing son chrome de vitrina — antes se
            // seleccionaban como texto de página al arrastrar el dedo.
            className="no-select text-center"
          >
            <span className="inline-flex items-center rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-ink/60 ring-1 ring-line">
              Staffing gastronómico en Argentina
            </span>

            <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl">
              Personal gastronómico, <span className="text-primary-text">ya</span>.
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-lg text-ink/60">
              Publicás un turno y en minutos tenés candidatos rankeados por
              cercanía y reputación.
            </p>

            <p className="mt-3 text-sm font-bold uppercase tracking-wide text-ink/40">
              Publicá. Elegí. Listo.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/register?rol=comercio"
                className="rounded-[var(--radius-btn)] bg-primary px-7 py-3.5 font-semibold text-white shadow-[0_8px_20px_rgba(255,107,0,0.28)] transition active:scale-95 hover:brightness-[1.04]"
              >
                Necesito personal
              </Link>
              <Link
                href="/register?rol=trabajador"
                className="rounded-[var(--radius-btn)] bg-white px-7 py-3.5 font-semibold text-ink ring-1 ring-line transition active:scale-95 hover:bg-surface"
              >
                Quiero trabajar
              </Link>
            </div>
          </motion.div>

          {/* Product shot: las tarjetas reales del producto — sticky y
              rotando con el scroll (ver ScrollHeroShowcase) */}
          <Reveal delay={0.15} className="mt-4">
            <ScrollHeroShowcase />
          </Reveal>
        </div>
      </section>

      {/* Cinta de puestos/barrios: desplazamiento continuo, full-bleed */}
      <section className="border-y border-line bg-white/70 py-4">
        <PositionsMarquee />
      </section>

      <div className="mx-auto max-w-5xl px-4">
        {/* Stats con vida: cuentan al entrar al viewport */}
        <StatsStrip />

        {/* Cómo funciona: narrativa con riel vertical que se dibuja con el scroll */}
        <HowItWorksTimeline />

        {/* Features bento: monocromo, una sola tarjeta en naranja sólido,
            con micro-parallax sutil por tarjeta. `.no-select` (regla C0,
            docs/PULIDO_ROADMAP.md fix 2): títulos y textos de marketing,
            chrome de vitrina, no contenido de lectura. */}
        <section className="no-select mt-20">
          <Reveal>
            <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Todo lo que necesitás para resolver el staffing
            </h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Reveal className="sm:col-span-2">
              <ParallaxCard range={PARALLAX_RANGES[0]}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="flex h-full flex-col justify-between rounded-[var(--radius-card)] bg-primary p-6 text-white shadow-[0_8px_20px_rgba(255,107,0,0.28)] transition"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <HERO_FEATURE.Icon size={22} />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-xl font-bold">{HERO_FEATURE.title}</h3>
                    <p className="mt-2 max-w-md text-white/85">{HERO_FEATURE.text}</p>
                  </div>
                </motion.div>
              </ParallaxCard>
            </Reveal>

            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06}>
                <ParallaxCard range={PARALLAX_RANGES[i + 1]} className="h-full">
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="h-full rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-line transition hover:shadow-[var(--shadow-float)]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-ink">
                      <f.Icon size={22} />
                    </div>
                    <h3 className="mt-4 font-bold text-ink">{f.title}</h3>
                    <p className="mt-2 text-sm text-ink/60">{f.text}</p>
                  </motion.div>
                </ParallaxCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Franja para trabajadores. `.no-select` (regla C0,
            docs/PULIDO_ROADMAP.md fix 2): título de marketing, chrome de
            vitrina. */}
        <Reveal className="mt-20">
          <section className="no-select rounded-[var(--radius-card)] bg-ink px-6 py-14 text-center text-white">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              ¿Trabajás en gastronomía? Elegí tus turnos.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-white/70">
              Sumate gratis, mirá los turnos cerca tuyo y postulate al que
              mejor te quede.
            </p>
            <div className="mt-7">
              <Link
                href="/register?rol=trabajador"
                className="inline-flex rounded-[var(--radius-btn)] border border-white/30 px-7 py-3.5 font-semibold text-white transition active:scale-95 hover:bg-white/10"
              >
                Quiero trabajar
              </Link>
            </div>
          </section>
        </Reveal>
      </div>

      {/* Footer */}
      <footer className="mt-20 bg-ink py-10 text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 text-center">
          {/* `.no-select`: wordmark de marca, chrome, no texto de lectura. */}
          <span className="no-select text-xl font-extrabold tracking-tight">
            staff<span className="text-primary-text">ya</span>
          </span>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/70">
            <Link href="/login" className="hover:text-white">
              Ingresar
            </Link>
            <Link href="/register" className="hover:text-white">
              Crear cuenta
            </Link>
            <Link href="/subscription" className="hover:text-white">
              Suscripción
            </Link>
            <Link href="/terminos" className="hover:text-white">
              Términos
            </Link>
            <Link href="/privacidad" className="hover:text-white">
              Privacidad
            </Link>
          </nav>
          <p className="text-xs text-white/40">
            © 2026 Julieta Arrazate — Staffya. Hecho en Argentina.
          </p>
        </div>
      </footer>
    </div>
  );
}
