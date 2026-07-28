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
              <Link href="/feed" replace className="hidden hover:text-primary md:inline">
                Turnos
              </Link>
              <Link href="/my-shifts" replace className="hidden hover:text-primary md:inline">
                Mis turnos
              </Link>
              <Link href="/chats" replace className="hidden hover:text-primary md:inline">
                Mensajes
              </Link>
              <Link href="/profile" replace className="hidden hover:text-primary md:inline">
                Mi perfil
              </Link>
            </>
          )}
          {!loading && user?.role === "employer" && (
            <>
              <Link href="/shifts" replace className="hidden hover:text-primary md:inline">
                Mis turnos
              </Link>
              <Link href="/search" replace className="hidden hover:text-primary md:inline">
                Buscar
              </Link>
              <Link href="/chats" replace className="hidden hover:text-primary md:inline">
                Mensajes
              </Link>
              <Link href="/subscription" replace className="hidden hover:text-primary md:inline">
                Mi plan
              </Link>
              <Link href="/profile" replace className="hidden hover:text-primary md:inline">
                Mi comercio
              </Link>
            </>
          )}
          {!loading && user?.role === "admin" && (
            <Link href="/admin" className="hidden hover:text-primary md:inline">
              Administración
            </Link>
          )}
          {!loading && user && <NotificationBell />}
          {!loading && user && (
            <button
              onClick={logout}
              className="hidden rounded-full bg-surface px-3 py-1.5 hover:bg-line md:inline"
            >
              Salir ({user.full_name})
            </button>
          )}
          {!loading && !user && (
            <>
              <Link href="/login" className="hover:text-primary">
                Ingresar
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-primary px-3.5 py-1.5 text-white shadow-sm shadow-orange-500/30 transition active:scale-95 hover:brightness-[1.04]"
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
