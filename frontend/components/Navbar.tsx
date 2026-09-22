"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import NotificationBell from "@/components/NotificationBell";
import Logo from "@/components/Logo";

/**
 * Link del header de escritorio, con estado activo.
 *
 * Hasta la auditoría de navegación (fase H) los 14 links eran
 * `hover:text-primary-text` a secas: en `md:` la barra inferior se oculta, así
 * que ESTE es el único menú, y no marcaba de ninguna forma en qué sección
 * estabas. En mobile "Inicio" se pinta de ámbar y en desktop los cinco links
 * se veían idénticos — verificado en un render limpio a 1440px, no de memoria.
 *
 * `aria-current="page"` además de color: la marca no puede viajar sólo en el
 * tinte (mismo criterio que F4/jsx-a11y en el resto de la app).
 */
function NavLink({
  href,
  children,
  replace = true,
}: {
  href: string;
  children: React.ReactNode;
  replace?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      replace={replace}
      aria-current={active ? "page" : undefined}
      className={`hidden md:inline ${
        active ? "font-semibold text-primary-text" : "hover:text-primary-text"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  // El onboarding es una pantalla de fondo ink con su propio logo: el header
  // blanco encima la cortaba al medio y duplicaba la marca.
  if (pathname === "/bienvenida") return null;

  return (
    // `safe-top`: con `viewport-fit=cover` (layout raíz) la página usa el alto
    // real de la pantalla, así que en PWA instalada el header arrancaría
    // DEBAJO de la barra de estado / notch. El padding del inset lo baja a la
    // zona visible, como cualquier app nativa.
    <header className="safe-top sticky top-0 z-40 border-b border-line bg-chrome">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="Inicio">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-4 text-sm font-medium">
          {!loading && user?.role === "worker" && (
            <>
              <NavLink href="/feed">Turnos</NavLink>
              <NavLink href="/map">Mapa</NavLink>
              <NavLink href="/my-shifts">Mis turnos</NavLink>
              <NavLink href="/chats">Mensajes</NavLink>
              <NavLink href="/profile">Mi perfil</NavLink>
            </>
          )}
          {!loading && user?.role === "employer" && (
            <>
              <NavLink href="/shifts">Mis turnos</NavLink>
              <NavLink href="/search">Buscar</NavLink>
              <NavLink href="/favorites">Favoritos</NavLink>
              <NavLink href="/chats">Mensajes</NavLink>
              <NavLink href="/subscription">Mi plan</NavLink>
              <NavLink href="/profile">Mi comercio</NavLink>
            </>
          )}
          {!loading && user?.role === "admin" && (
            <>
              {/* `replace` como todos: era el ÚNICO link de sección sin él,
                  aunque la barra inferior sí navega a `/admin` con replace.
                  Con `push`, al admin el botón "atrás" le retrocedía pestaña
                  por pestaña en vez de salir de la sección — el mismo síntoma
                  que ya se había corregido en `BottomNav`. */}
              <NavLink href="/admin">Administración</NavLink>
              <NavLink href="/map">Mapa</NavLink>
              <NavLink href="/search">Buscar</NavLink>
            </>
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
              <Link href="/login" className="hover:text-primary-text">
                Ingresar
              </Link>
              <Link
                href="/register"
                className="rounded-[var(--radius-btn)] bg-primary px-3.5 py-1.5 text-night shadow-[var(--shadow-primary)] transition active:scale-95 hover:brightness-[1.04]"
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
