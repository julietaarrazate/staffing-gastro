"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import Logo from "@/components/Logo";
import {
  BellIcon,
  BoltIcon,
  CheckCircleIcon,
  ClipboardIcon,
  MapPinIcon,
  MessageIcon,
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const STEPS = [
  {
    Icon: ClipboardIcon,
    title: "Publicá el turno",
    text: "Cargá la posición, el horario y la paga. En segundos queda visible.",
    gradient: "from-orange-500 to-red-500",
  },
  {
    Icon: BoltIcon,
    title: "Te recomendamos personal",
    text: "Nuestro motor rankea candidatos por cercanía, experiencia y reputación.",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    Icon: CheckCircleIcon,
    title: "Asignás y listo",
    text: "El trabajador confirma, hace check-in con ubicación y coordinan por chat.",
    gradient: "from-emerald-500 to-teal-600",
  },
];

const FEATURES = [
  {
    Icon: MapPinIcon,
    title: "Asistencia con GPS",
    text: "Check-in y check-out geolocalizado para saber que todo salió bien.",
    gradient: "from-sky-500 to-blue-600",
  },
  {
    Icon: MessageIcon,
    title: "Chat integrado",
    text: "Coordiná los detalles de cada turno sin salir de la app.",
    gradient: "from-purple-500 to-indigo-600",
  },
  {
    Icon: StarIcon,
    title: "Reputación",
    text: "Rating, puntualidad e historial para elegir con confianza.",
    gradient: "from-amber-400 to-orange-500",
  },
  {
    Icon: BellIcon,
    title: "Notificaciones",
    text: "Enterate al instante de asignaciones, confirmaciones y pagos.",
    gradient: "from-pink-500 to-rose-500",
  },
];

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="relative overflow-hidden">
      {/* Glow decorativo de fondo, con un pulso suave que da vida al hero */}
      <motion.div
        aria-hidden
        animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.8, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-orange-200 via-amber-100 to-transparent blur-3xl"
      />

      <div className="mx-auto max-w-5xl px-4 py-14">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 13, delay: 0.1 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/30"
          >
            <Logo size={40} withWordmark={false} />
          </motion.div>
          <h1 className="mt-7 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
            Cubrí un turno en{" "}
            <span className="bg-gradient-to-br from-orange-500 to-red-500 bg-clip-text text-transparent">
              menos de 10 minutos
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
            Staffya conecta comercios gastronómicos y eventos con personal eventual,
            en tiempo real. Como pedir un delivery, pero de staff.
          </p>

          {!loading && !user && (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className="rounded-full bg-gradient-to-br from-orange-500 to-red-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-orange-500/30 transition active:scale-95 hover:shadow-xl"
              >
                Crear cuenta gratis
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-white px-7 py-3.5 font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition active:scale-95 hover:bg-zinc-50"
              >
                Ya tengo cuenta
              </Link>
            </div>
          )}

          {!loading && user?.role === "worker" && (
            <div className="mt-8">
              <Link
                href="/feed"
                className="rounded-full bg-gradient-to-br from-orange-500 to-red-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-orange-500/30 transition active:scale-95 hover:shadow-xl"
              >
                Ver turnos disponibles
              </Link>
            </div>
          )}

          {!loading && user?.role === "employer" && (
            <div className="mt-8">
              <Link
                href="/shifts"
                className="rounded-full bg-gradient-to-br from-orange-500 to-red-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-orange-500/30 transition active:scale-95 hover:shadow-xl"
              >
                Ver mis turnos
              </Link>
            </div>
          )}
        </motion.section>

        {/* Cómo funciona */}
        <section className="mt-24">
          <Reveal>
            <h2 className="text-center text-2xl font-extrabold tracking-tight text-zinc-900">
              Cómo funciona
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="relative h-full overflow-hidden rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-zinc-100 transition hover:shadow-lg"
                >
                  <span className="absolute right-3 top-3 text-3xl font-extrabold text-zinc-100">
                    {i + 1}
                  </span>
                  <div
                    className={`relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${s.gradient} text-white shadow-md`}
                  >
                    <s.Icon size={26} />
                  </div>
                  <p className="relative z-10 mt-4 text-xs font-bold uppercase tracking-wide text-orange-600">
                    Paso {i + 1}
                  </p>
                  <h3 className="relative z-10 mt-1 font-bold text-zinc-900">{s.title}</h3>
                  <p className="relative z-10 mt-2 text-sm text-zinc-600">{s.text}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mt-20">
          <Reveal>
            <h2 className="text-center text-2xl font-extrabold tracking-tight text-zinc-900">
              Todo lo que necesitás para resolver el staffing
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="h-full rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 transition hover:shadow-lg"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.gradient} text-white shadow-md`}
                  >
                    <f.Icon size={22} />
                  </div>
                  <h3 className="mt-4 font-bold text-zinc-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{f.text}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA final */}
        {!loading && !user && (
          <Reveal className="relative mt-20 overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-red-500 px-6 py-14 text-center text-white shadow-xl shadow-orange-500/30">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl"
            />
            <h2 className="relative z-10 text-2xl font-extrabold sm:text-3xl">
              ¿Listo para cubrir tu próximo turno?
            </h2>
            <p className="relative z-10 mx-auto mt-2 max-w-xl text-orange-50">
              Sumate gratis. Sin contratos, sin vueltas: publicás y resolvés.
            </p>
            <div className="relative z-10 mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className="rounded-full bg-white px-7 py-3.5 font-semibold text-orange-600 shadow-lg transition active:scale-95 hover:bg-orange-50"
              >
                Crear cuenta
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/60 px-7 py-3.5 font-semibold text-white transition active:scale-95 hover:bg-white/10"
              >
                Ingresar
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
