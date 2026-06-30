"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import NotificationBell from "@/components/NotificationBell";
import Logo from "@/components/Logo";

export default function Navbar() {
  const { user, logout, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="Inicio">
          <Logo />
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          {!loading && user?.role === "worker" && (
            <>
              <Link href="/feed" className="hidden hover:text-orange-600 md:inline">
                Turnos
              </Link>
              <Link href="/my-shifts" className="hidden hover:text-orange-600 md:inline">
                Mis turnos
              </Link>
              <Link href="/chats" className="hidden hover:text-orange-600 md:inline">
                Mensajes
              </Link>
              <Link href="/profile" className="hidden hover:text-orange-600 md:inline">
                Mi perfil
              </Link>
            </>
          )}
          {!loading && user?.role === "employer" && (
            <>
              <Link href="/shifts" className="hidden hover:text-orange-600 md:inline">
                Mis turnos
              </Link>
              <Link href="/search" className="hidden hover:text-orange-600 md:inline">
                Buscar
              </Link>
              <Link href="/chats" className="hidden hover:text-orange-600 md:inline">
                Mensajes
              </Link>
              <Link href="/profile" className="hidden hover:text-orange-600 md:inline">
                Mi comercio
              </Link>
            </>
          )}
          {!loading && user?.role === "admin" && (
            <Link href="/admin" className="hidden hover:text-orange-600 md:inline">
              Administración
            </Link>
          )}
          {!loading && user && <NotificationBell />}
          {!loading && user && (
            <button
              onClick={logout}
              className="hidden rounded-full bg-zinc-100 px-3 py-1.5 hover:bg-zinc-200 md:inline"
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
                className="rounded-full bg-gradient-to-br from-orange-500 to-red-500 px-3.5 py-1.5 text-white shadow-sm shadow-orange-500/30 transition active:scale-95 hover:shadow-md"
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
