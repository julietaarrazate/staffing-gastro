"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentType, ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import OpportunityCard from "@/components/worker/OpportunityCard";
import type { Shift, WorkerSkill } from "@/lib/types";
import {
  BellIcon,
  BoltIcon,
  type IconProps,
  ClipboardIcon,
  MapPinIcon,
  MessageIcon,
  ShareIcon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/icons";

/** Aparece con fade + slide al entrar en viewport (una sola vez). */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Turnos de ejemplo con la pinta real del feed (mismo componente que ve un
// trabajador logueado). Sin foto de local: cae al estado real "sin foto" de
// OpportunityCard (tinte de rubro + ícono grande), no una imagen inventada.
function exampleShift(input: {
  id: string;
  position: WorkerSkill;
  city: string;
  pay: number;
  start: string;
  end: string;
  companyName: string;
  urgent?: boolean;
  dressCode?: string;
}): Shift {
  return {
    id: input.id,
    company_id: input.id,
    position: input.position,
    quantity: 1,
    start_at: input.start,
    end_at: input.end,
    pay_amount: String(input.pay),
    currency: "ARS",
    tips: true,
    dress_code: input.dressCode ?? null,
    urgent: input.urgent ?? false,
    address: null,
    city: input.city,
    latitude: null,
    longitude: null,
    title: null,
    description: null,
    status: "publicado",
    worker_profile_id: null,
    check_in_latitude: null,
    check_in_longitude: null,
    check_in_at: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_at: null,
    paid_at: null,
    created_at: null,
    company_name: input.companyName,
    company_logo_url: null,
  };
}

const EXAMPLE_SHIFTS: Shift[] = [
  exampleShift({
    id: "demo-1",
    position: "mozo",
    city: "Palermo",
    pay: 70000,
    // Mismo día (no cruza medianoche): formatShiftRange usa el formato corto
    // de una línea — clave para que el texto entre cómodo en la tarjeta.
    start: "2026-07-24T19:00:00-03:00",
    end: "2026-07-24T23:30:00-03:00",
    companyName: "Bar Uriarte",
    urgent: true,
    dressCode: "Camisa negra",
  }),
  exampleShift({
    id: "demo-2",
    position: "bartender",
    city: "San Telmo",
    pay: 85000,
    start: "2026-07-25T20:00:00-03:00",
    end: "2026-07-25T23:45:00-03:00",
    companyName: "Coctelería Defensa",
  }),
  exampleShift({
    id: "demo-3",
    position: "barista",
    city: "Recoleta",
    pay: 52000,
    start: "2026-07-26T09:00:00-03:00",
    end: "2026-07-26T15:00:00-03:00",
    companyName: "Café Quintana",
  }),
];

/**
 * Product shot del hero: las tarjetas reales de turno (OpportunityCard),
 * en stack, "saliendo" de un marco de celular dibujado con CSS — nada de
 * ilustraciones, es el producto tal cual lo ve un trabajador en el feed.
 */
function PhoneShowcase() {
  return (
    <div className="relative mx-auto h-[560px] w-[320px] select-none sm:h-[600px] sm:w-[340px]">
      {/* Chasis del teléfono */}
      <div className="absolute inset-x-0 top-0 h-[500px] rounded-[3rem] bg-ink p-2.5 shadow-2xl sm:h-[536px]">
        <div className="relative h-full w-full overflow-hidden rounded-[2.4rem] bg-paper">
          <div className="absolute left-1/2 top-3 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-ink/15" />
          <div className="px-6 pt-11">
            <div className="h-3 w-28 rounded-full bg-ink/10" />
            <div className="mt-2.5 h-2 w-20 rounded-full bg-ink/5" />
          </div>
        </div>
      </div>

      {/* Stack de tarjetas, apoyado sobre el teléfono. Ancho generoso (~90%
          del ancho de la pantalla) para que el cuerpo de la tarjeta real
          (pago, horario, cantidad) entre en una línea — más angosto hace
          que el texto haga wrap y le robe alto al hero de la tarjeta. */}
      <div className="absolute inset-x-0 top-[92px] z-20 mx-auto w-[276px] sm:top-[100px] sm:w-[292px]">
        <div className="relative h-[440px] sm:h-[460px]">
          <div className="absolute inset-0 translate-x-4 translate-y-7 rotate-[6deg] opacity-90">
            <OpportunityCard shift={EXAMPLE_SHIFTS[2]} />
          </div>
          <div className="absolute inset-0 -translate-x-3 translate-y-3 -rotate-[4deg] opacity-95">
            <OpportunityCard shift={EXAMPLE_SHIFTS[1]} />
          </div>
          <div className="absolute inset-0">
            <OpportunityCard shift={EXAMPLE_SHIFTS[0]} />
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    Icon: ClipboardIcon,
    title: "Publicá el turno",
    text: "Cargá la posición, el horario y la paga. Queda visible al instante.",
  },
  {
    Icon: BoltIcon,
    title: "Elegí de una lista rankeada",
    text: "Te mostramos candidatos ordenados por cercanía, experiencia y reputación.",
  },
  {
    Icon: ShieldIcon,
    title: "Listo, turno cubierto",
    text: "El trabajador confirma, hace check-in con ubicación y coordinan por chat.",
  },
];

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

  // Mientras carga la sesión o se está redirigiendo a un usuario logueado,
  // no parpadeamos la landing.
  if (loading || user) return null;

  return (
    <div className="overflow-x-clip">
      {/* Hero: papel cálido, un solo acento naranja */}
      <section className="bg-paper">
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:pt-20">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
            className="text-center"
          >
            <span className="inline-flex items-center rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-ink/60 ring-1 ring-line">
              Staffing gastronómico en Argentina
            </span>

            <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl">
              Personal gastronómico, <span className="text-primary">ya</span>.
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
                href="/register"
                className="rounded-[var(--radius-btn)] bg-primary px-7 py-3.5 font-semibold text-white shadow-[0_8px_20px_rgba(255,107,0,0.28)] transition active:scale-95 hover:brightness-[1.04]"
              >
                Necesito personal
              </Link>
              <Link
                href="/register"
                className="rounded-[var(--radius-btn)] bg-white px-7 py-3.5 font-semibold text-ink ring-1 ring-line transition active:scale-95 hover:bg-surface"
              >
                Quiero trabajar
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {["Mozo", "Bartender", "Palermo", "San Telmo"].map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink/60 ring-1 ring-line"
                >
                  {label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Product shot: las tarjetas reales del producto */}
          <Reveal delay={0.15} className="mt-4">
            <PhoneShowcase />
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4">
        {/* Cómo funciona */}
        <section className="mt-20 sm:mt-24">
          <Reveal>
            <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Cómo funciona
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="relative h-full overflow-hidden rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-line transition hover:shadow-[var(--shadow-float)]"
                >
                  <span className="text-4xl font-extrabold tracking-tight text-ink/10">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="mt-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-ink">
                    <s.Icon size={22} />
                  </div>
                  <h3 className="mt-4 font-bold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm text-ink/60">{s.text}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Features bento: monocromo, una sola tarjeta en naranja sólido */}
        <section className="mt-20">
          <Reveal>
            <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Todo lo que necesitás para resolver el staffing
            </h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Reveal className="sm:col-span-2">
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
            </Reveal>

            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06}>
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
              </Reveal>
            ))}
          </div>
        </section>

        {/* Franja para trabajadores */}
        <Reveal className="mt-20">
          <section className="rounded-[var(--radius-card)] bg-ink px-6 py-14 text-center text-white">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              ¿Trabajás en gastronomía? Elegí tus turnos.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-white/70">
              Sumate gratis, mirá los turnos cerca tuyo y postulate al que
              mejor te quede.
            </p>
            <div className="mt-7">
              <Link
                href="/register"
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
          <span className="text-xl font-extrabold tracking-tight">
            staff<span className="text-primary">ya</span>
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
