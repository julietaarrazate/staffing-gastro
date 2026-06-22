"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import Logo from "@/components/Logo";

const STEPS = [
  {
    emoji: "📝",
    title: "Publicá el turno",
    text: "Cargá la posición, el horario y la paga. En segundos queda visible.",
  },
  {
    emoji: "⚡",
    title: "Te recomendamos personal",
    text: "Nuestro motor rankea candidatos por cercanía, experiencia y reputación.",
  },
  {
    emoji: "✅",
    title: "Asignás y listo",
    text: "El trabajador confirma, hace check-in con ubicación y coordinan por chat.",
  },
];

const FEATURES = [
  { emoji: "📍", title: "Asistencia con GPS", text: "Check-in y check-out geolocalizado para saber que todo salió bien." },
  { emoji: "💬", title: "Chat integrado", text: "Coordiná los detalles de cada turno sin salir de la app." },
  { emoji: "⭐", title: "Reputación", text: "Rating, puntualidad e historial para elegir con confianza." },
  { emoji: "🔔", title: "Notificaciones", text: "Enterate al instante de asignaciones, confirmaciones y pagos." },
];

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {/* Hero */}
      <section className="text-center">
        <div className="flex justify-center">
          <Logo size={64} withWordmark={false} />
        </div>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
          Cubrí un turno en{" "}
          <span className="text-orange-600">menos de 10 minutos</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
          Staffya conecta comercios gastronómicos y eventos con personal eventual,
          en tiempo real. Como pedir un delivery, pero de staff.
        </p>

        {!loading && !user && (
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="rounded-full bg-orange-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-orange-700"
            >
              Crear cuenta gratis
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-zinc-300 px-6 py-3 font-semibold transition hover:bg-zinc-100"
            >
              Ya tengo cuenta
            </Link>
          </div>
        )}

        {!loading && user?.role === "worker" && (
          <div className="mt-8">
            <Link
              href="/feed"
              className="rounded-full bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700"
            >
              Ver turnos disponibles
            </Link>
          </div>
        )}

        {!loading && user?.role === "employer" && (
          <div className="mt-8">
            <Link
              href="/shifts"
              className="rounded-full bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700"
            >
              Ver mis turnos
            </Link>
          </div>
        )}
      </section>

      {/* Cómo funciona */}
      <section className="mt-20">
        <h2 className="text-center text-2xl font-bold text-zinc-900">Cómo funciona</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-zinc-100"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-2xl">
                {s.emoji}
              </div>
              <p className="mt-3 text-sm font-bold text-orange-600">Paso {i + 1}</p>
              <h3 className="mt-1 font-bold text-zinc-900">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mt-20">
        <h2 className="text-center text-2xl font-bold text-zinc-900">
          Todo lo que necesitás para resolver el staffing
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 transition hover:shadow-md"
            >
              <div className="text-3xl">{f.emoji}</div>
              <h3 className="mt-3 font-bold text-zinc-900">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      {!loading && !user && (
        <section className="mt-20 rounded-3xl bg-gradient-to-b from-orange-500 to-orange-600 px-6 py-12 text-center text-white">
          <h2 className="text-2xl font-bold sm:text-3xl">
            ¿Listo para cubrir tu próximo turno?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-orange-50">
            Sumate gratis. Sin contratos, sin vueltas: publicás y resolvés.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="rounded-full bg-white px-6 py-3 font-semibold text-orange-600 transition hover:bg-orange-50"
            >
              Crear cuenta
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/60 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Ingresar
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
