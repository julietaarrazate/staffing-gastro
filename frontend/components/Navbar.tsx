"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import NotificationBell from "@/components/NotificationBell";
import Logo from "@/components/Logo";
import { PlusIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { estaPublicando } from "@/lib/publicando";
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
  tambien = [],
}: {
  href: string;
  children: ReactNode;
  replace?: boolean;
  /** Otras pantallas que viven bajo esta sección (el Mapa, bajo Buscar). */
  tambien?: string[];
}) {
  const pathname = usePathname();
  const active = [href, ...tambien].some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
  return (
    <Link
      href={href}
      replace={replace}
      aria-current={active ? "page" : undefined}
      // La misma ancla que la barra de abajo (`BottomNav`): el recorrido
      // guiado señala el destino que se ve en cada ancho.
      data-tour={`nav-${href.slice(1)}`}
      className={`hidden h-9 items-center whitespace-nowrap rounded-full px-2.5 md:inline-flex lg:px-3 ${
        active ? "bg-primary-tint text-primary-text" : "text-ink-soft hover:text-primary-text"
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

/** Las pantallas de acceso con la dirección suave (`components/acceso/PantallaAcceso.tsx`). */
function esPantallaDeAcceso(pathname: string) {
  return ["/login", "/register", "/recuperar", "/restablecer", "/verificar-email"].includes(pathname);
}

export default function Navbar() {
  const { user, loading, reconnecting } = useAuth();
  const pathname = usePathname();
  // Quien trabaja y el comercio no llevan encabezado en el celular (Julieta,
  // 2026-11-20): el cielo de cada pantalla llega hasta arriba, y «oído» y la
  // campanita van sobre el cielo del Inicio y del Panel. `data-cromo="app"` en
  // `<html>` le dice a `globals.css` que arriba ya no hay nada que descontar.
  // No en las pantallas propias, sin barras (la bienvenida trae su zona segura).
  const pantallaPropia = pathname === "/bienvenida" || pathname === "/historia" || pathname === "/encuesta";
  // El acceso y la bienvenida (2026-11-21) también arrancan con su propio cielo
  // hasta arriba: el «oído» del cielo reemplaza al encabezado. El admin, que
  // conserva su encabezado en el celular, queda afuera.
  const conCieloPropio = (esPantallaDeAcceso(pathname) || pathname === "/bienvenida") && user?.role !== "admin";
  const sinEncabezadoEnCelular =
    conCieloPropio || (!pantallaPropia && (user?.role === "worker" || user?.role === "employer"));
  useEffect(() => {
    const raiz = document.documentElement;
    if (sinEncabezadoEnCelular) raiz.dataset.cromo = "app";
    else delete raiz.dataset.cromo;
    return () => {
      delete raiz.dataset.cromo;
    };
  }, [sinEncabezadoEnCelular]);

  // El onboarding es una pantalla de fondo ink con su propio logo: el header
  // blanco encima la cortaba al medio y duplicaba la marca.
  if (pathname === "/bienvenida") return null;
  // El ingreso y sus pantallas hermanas llevan el «oído» en su propio cielo:
  // sin sesión no hay encabezado (con sesión, el de siempre).
  if (!user && esPantallaDeAcceso(pathname)) return null;
  // La landing (visitante sin sesión) lleva su propio encabezado
  // (components/landing/LandingHeader.tsx). Con sesión, "/" redirige a la home del rol y este header sigue apareciendo.
  // Con una sesión guardada que todavía no se pudo confirmar tampoco va la de
  // visitante: se ve este header, en su estado neutro.
  if (pathname === "/" && !user && !reconnecting) return null;
  // /historia (la landing anterior, guardada para grabar reels) trae su
  // propio encabezado, con o sin sesión.
  if (pathname === "/historia") return null;
  // La encuesta para locales es una pantalla propia, con su cielo y sin barras.
  if (pathname === "/encuesta") return null;

  if (user) return <BarraConSesion />;

  return (
    // `safe-top`: con `viewport-fit=cover` (layout raíz) la página usa el alto
    // real de la pantalla, así que en PWA instalada el header arrancaría
    // DEBAJO de la barra de estado / notch. El padding del inset lo baja a la
    // zona visible, como cualquier app nativa.
    // Mientras no se sabe si hay sesión (`loading`), en el celular no se
    // dibuja: a quien tiene sesión le aparecía la franja un instante y la
    // pantalla saltaba al irse.
    <header
      className={cn(
        "safe-top sticky top-0 z-40 border-b border-line bg-chrome backdrop-blur-xl backdrop-saturate-150 print:hidden",
        loading && "hidden md:block"
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="Inicio">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-3 text-sm font-medium lg:gap-4">
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
        "inline-flex h-9 items-center whitespace-nowrap rounded-[var(--radius-relieve)] px-3.5 font-semibold transition duration-150 active:scale-95 active:bg-secondary active:text-on-brand",
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

/**
 * La barra de arriba con sesión (Julieta, 2026-11-20): la misma píldora blanca
 * que flota abajo en el celular, acá arriba, con la sección activa en su óvalo
 * celeste, la campanita y «Salir». Para el comercio, «Publicar turno» va al
 * lado, en azul hondo, como el «+» del celular.
 *
 * Quien trabaja y el comercio la ven sólo en la compu (en el celular navegan
 * con la barra de abajo); el admin, que no tiene cielo en sus pantallas, la
 * conserva también en el celular, con el logo y la campanita.
 */
function BarraConSesion() {
  const { user, logout, twoFactorSetupPending } = useAuth();
  const pathname = usePathname();
  if (!user) return null;
  const soloCompu = user.role === "worker" || user.role === "employer";

  return (
    <header className={cn("barra-compu-cielo safe-top sticky top-0 z-40 print:hidden", soloCompu && "hidden md:block")}>
      <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 pt-3">
        <div className="barra-compu flex h-[52px] min-w-0 flex-1 items-center justify-between gap-2 pl-5 pr-2">
          <Link href="/" aria-label="Inicio">
            <Logo />
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-0.5 text-sm font-semibold lg:gap-1">
            {user.role === "worker" && (
              <>
                {/* Las mismas cinco secciones que la barra de abajo del
                    celular (2026-11-20): el Mapa vive bajo Buscar. */}
                <NavLink href="/feed">Inicio</NavLink>
                <NavLink href="/buscar" tambien={["/map"]}>
                  Buscar
                </NavLink>
                <NavLink href="/my-shifts">Turnos</NavLink>
                <NavLink href="/chats">Mensajes</NavLink>
                <NavLink href="/profile">Mi perfil</NavLink>
              </>
            )}
            {user.role === "employer" && (
              <>
                <NavLink href="/shifts">Panel</NavLink>
                <NavLink href="/search">Buscar</NavLink>
                <NavLink href="/favorites">Favoritos</NavLink>
                <NavLink href="/chats">Mensajes</NavLink>
                <NavLink href="/subscription">Mi plan</NavLink>
                <NavLink href="/profile">Mi comercio</NavLink>
              </>
            )}
            {user.role === "admin" && !twoFactorSetupPending && (
              <>
                <NavLink href="/admin">Administración</NavLink>
                <NavLink href="/map">Mapa</NavLink>
                <NavLink href="/search">Buscar</NavLink>
              </>
            )}
            {!twoFactorSetupPending && <NotificationBell />}
            {/* Sólo «Salir», sin el nombre: con el nombre completo del comercio
                la barra no entraba en una tablet. El nombre sigue en el nombre
                accesible y en el tooltip. */}
            <button
              onClick={logout}
              aria-label={`Salir (${user.full_name})`}
              title={`Salir (${user.full_name})`}
              className="hidden h-9 items-center whitespace-nowrap rounded-full px-2.5 text-ink-soft hover:bg-surface hover:text-ink md:inline-flex lg:px-3"
            >
              Salir
            </button>
          </nav>
        </div>
        {/* Publicando no va: ya se está en eso. */}
        {user.role === "employer" && !estaPublicando(pathname) && (
          <Link href="/shifts/new" aria-label="Publicar turno" data-tour="shifts-publish" className="barra-compu-mas">
            <PlusIcon size={22} strokeWidth={2.2} />
            <span className="hidden lg:inline">Publicar turno</span>
          </Link>
        )}
      </div>
    </header>
  );
}
