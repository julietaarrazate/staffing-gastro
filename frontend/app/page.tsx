"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
        Cubrí un turno en{" "}
        <span className="text-orange-600">menos de 10 minutos</span>
      </h1>
      <p className="mt-4 text-lg text-zinc-600">
        Staffya conecta comercios gastronómicos y eventos con personal eventual,
        en tiempo real.
      </p>

      {!loading && !user && (
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/register"
            className="rounded-full bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700"
          >
            Crear cuenta
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-zinc-300 px-6 py-3 font-semibold hover:bg-zinc-100"
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
    </div>
  );
}
