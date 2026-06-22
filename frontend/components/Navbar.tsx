"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import NotificationBell from "@/components/NotificationBell";

export default function Navbar() {
  const { user, logout, loading } = useAuth();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-orange-600">
          Staffya
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          {!loading && user?.role === "worker" && (
            <>
              <Link href="/feed" className="hover:text-orange-600">
                Turnos
              </Link>
              <Link href="/my-shifts" className="hover:text-orange-600">
                Mis turnos
              </Link>
              <Link href="/chats" className="hover:text-orange-600">
                Mensajes
              </Link>
              <Link href="/profile" className="hover:text-orange-600">
                Mi perfil
              </Link>
            </>
          )}
          {!loading && user?.role === "employer" && (
            <>
              <Link href="/shifts" className="hover:text-orange-600">
                Mis turnos
              </Link>
              <Link href="/chats" className="hover:text-orange-600">
                Mensajes
              </Link>
              <Link href="/profile" className="hover:text-orange-600">
                Mi comercio
              </Link>
            </>
          )}
          {!loading && user && <NotificationBell />}
          {!loading && user && (
            <button
              onClick={logout}
              className="rounded-full bg-zinc-100 px-3 py-1.5 hover:bg-zinc-200"
            >
              Salir ({user.full_name})
            </button>
          )}
          {!loading && !user && (
            <>
              <Link href="/login" className="hover:text-orange-600">
                Ingresar
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-orange-600 px-3 py-1.5 text-white hover:bg-orange-700"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
