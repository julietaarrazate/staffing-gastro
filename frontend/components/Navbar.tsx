"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import NotificationBell from "@/components/NotificationBell";
import Logo from "@/components/Logo";
import { cn } from "@/lib/cn";
import { loginHref, nextDeCabecera, registerHref, safeNext } from "@/lib/safe-next";

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
  children: ReactNode;
  replace?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      replace={replace}
      aria-current={active ? "page" : undefined}
      className={`hidden whitespace-nowrap md:inline ${
        active ? "font-semibold text-primary-text" : "hover:text-primary-text"
      }`}
    >
      {children}
    </Link>
  );
}

/** «Ingresar» y «Crear cuenta» de la cabecera: vuelven a la pantalla en la que
 * estaba la persona, pero sólo en las pantallas que sí vuelven
 * (`nextDeCabecera`). Entre `/login` y `/register` se pasa el `next` que ya
 * traían (validado: viene de la dirección). `Suspense` porque lee la query. */
function AuthLinks({ next }: { next: string | null }) {
  const pathname = usePathname();
  return (
    <>
      <AuthLink href={loginHref({ next })} active={pathname === "/login"}>
        Ingresar
      </AuthLink>
      <AuthLink href={registerHref({ next })} active={pathname === "/register"} outlined>
        Crear cuenta
      </AuthLink>
    </>
  );
}

function AuthLinksConVuelta() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  let next: string | null;
  if (pathname === "/login" || pathname === "/register") {
    next = safeNext(searchParams.get("next"));
  } else {
    next = nextDeCabecera(pathname, searchParams.toString());
  }
  return <AuthLinks next={next} />;
}

export default function Navbar() {
  const { user, logout, loading, reconnecting } = useAuth();
  const pathname = usePathname();

  // El onboarding es una pantalla de fondo ink con su propio logo: el header
  // blanco encima la cortaba al medio y duplicaba la marca.
  if (pathname === "/bienvenida") return null;
  // La landing (visitante sin sesión) lleva su propio encabezado
  // (components/landing/LandingHeader.tsx). Con sesión, "/" redirige a la home del rol y este header sigue apareciendo.
  // Con una sesión guardada que todavía no se pudo confirmar tampoco va la de
  // visitante: se ve este header, en su estado neutro.
  if (pathname === "/" && !user && !reconnecting) return null;
  // /historia (la landing anterior, guardada para grabar reels) trae su
  // propio encabezado, con o sin sesión.
  if (pathname === "/historia") return null;

  return (
    // `safe-top`: con `viewport-fit=cover` (layout raíz) la página usa el alto
    // real de la pantalla, así que en PWA instalada el header arrancaría
    // DEBAJO de la barra de estado / notch. El padding del inset lo baja a la
    // zona visible, como cualquier app nativa.
    <header className="safe-top sticky top-0 z-40 border-b border-line bg-chrome backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="Inicio">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-3 text-sm font-medium lg:gap-4">
          {!loading && user?.role === "worker" && (
            <>
              <NavLink href="/feed">Turnos</NavLink>
              <NavLink href="/buscar">Buscar</NavLink>
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
          {/* Sólo "Salir", sin el nombre: con el nombre completo del comercio
              ("Salir (Parrilla y Vermutería Don Julián)") el header no entraba
              en una tablet y los links pasaban a dos líneas hasta los ~1000px.
              El nombre sigue en el nombre accesible y en el tooltip, y la
              cuenta ya se ve en "Mi comercio"/"Mi perfil". */}
          {!loading && user && (
            <button
              onClick={logout}
              aria-label={`Salir (${user.full_name})`}
              title={`Salir (${user.full_name})`}
              className="hidden whitespace-nowrap rounded-full bg-surface px-3 py-1.5 hover:bg-line md:inline"
            >
              Salir
            </button>
          )}
          {/* Hay una sesión guardada y el servidor todavía no contestó (U114):
              ni los links de la cuenta ni «Ingresar», que haría creer que la
              sesión se perdió. `AuthProvider` reintenta solo. */}
          {!loading && !user && reconnecting && (
            <span role="status" className="whitespace-nowrap text-ink/60">
              Reconectando…
            </span>
          )}
          {!loading && !user && !reconnecting && (
            <>
              {/* El de la pantalla en la que estás queda marcado (celeste de
                  marca), el otro en contorno. Antes "Crear cuenta" iba
                  siempre en ámbar: en /login parecía el elegido e "Ingresar"
                  quedaba en blanco (Julieta, 2026-10-13). Sin ámbar acá: el
                  ámbar de la pantalla es su botón principal. */}
              <Suspense fallback={<AuthLinks next={null} />}>
                <AuthLinksConVuelta />
              </Suspense>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

/** "Ingresar" / "Crear cuenta" sin sesión: marca el de la pantalla actual y
 *  responde al toque (se hunde y se tiñe) para que se vea cuál se eligió. */
function AuthLink({
  href,
  active,
  outlined,
  children,
}: {
  href: string;
  active: boolean;
  outlined?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center whitespace-nowrap rounded-[var(--radius-btn)] px-3.5 font-semibold transition duration-150 active:scale-95 active:bg-secondary active:text-on-brand",
        active
          ? "bg-secondary text-on-brand"
          : outlined
            ? "text-ink ring-[1.5px] ring-ink/70 ring-inset hover:bg-surface"
            : "text-ink hover:text-primary-text"
      )}
    >
      {children}
    </Link>
  );
}
