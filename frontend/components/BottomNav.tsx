"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  ClipboardIcon,
  HomeIcon,
  MapPinIcon,
  MessageIcon,
  SearchIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";

const WORKER_TABS = [
  { href: "/feed", label: "Inicio", Icon: HomeIcon },
  { href: "/buscar", label: "Buscar", Icon: SearchIcon },
  { href: "/map", label: "Mapa", Icon: MapPinIcon },
  { href: "/my-shifts", label: "Matches", Icon: ClipboardIcon },
  { href: "/chats", label: "Chats", Icon: MessageIcon },
  { href: "/profile", label: "Perfil", Icon: UsersIcon },
];

const EMPLOYER_TABS = [
  { href: "/shifts", label: "Panel", Icon: HomeIcon },
  { href: "/search", label: "Buscar", Icon: MapPinIcon },
  { href: "/chats", label: "Chats", Icon: MessageIcon },
  { href: "/profile", label: "Perfil", Icon: UsersIcon },
];

const ADMIN_TABS = [
  { href: "/admin", label: "Panel", Icon: ShieldIcon },
  { href: "/map", label: "Mapa", Icon: MapPinIcon },
  { href: "/search", label: "Buscar", Icon: SearchIcon },
  { href: "/profile", label: "Perfil", Icon: UsersIcon },
];

const TABS_BY_ROLE: Record<string, typeof WORKER_TABS> = {
  worker: WORKER_TABS,
  employer: EMPLOYER_TABS,
  admin: ADMIN_TABS,
};

export default function BottomNav() {
  const { user, loading, twoFactorSetupPending } = useAuth();
  const pathname = usePathname();

  if (loading || !user) return null;
  // Admin con el alta de la verificación en dos pasos pendiente (ADR-0023): el
  // backend le rechaza todo lo demás, así que la barra sólo llevaría a pantallas
  // con error (U133). Mismo criterio que el menú de `admin/layout.tsx`.
  if (twoFactorSetupPending) return null;
  // El onboarding es una pantalla de configuración inicial a pantalla completa:
  // la barra tapaba su botón principal, y navegar a otra sección antes de
  // terminar deja el perfil a medias (sin zona ni oficio el feed no sirve).
  if (pathname === "/bienvenida") return null;
  // /historia es la landing anterior, para grabar reels: sin barra de la app.
  if (pathname === "/historia") return null;
  // La encuesta para locales es una pantalla propia, con su cielo y sin barras.
  if (pathname === "/encuesta") return null;

  const tabs = TABS_BY_ROLE[user.role] ?? EMPLOYER_TABS;

  return (
    // `aria-label`: en la misma página vive también el `<nav>` del header, y
    // sin nombre un lector de pantalla anuncia "navegación, navegación" sin
    // forma de distinguirlas (auditoría de navegación, fase H).
    <nav
      aria-label="Secciones"
      // Con la dirección «con relieve» (2026-11-19, ADR-0027): pegada al
      // borde, lisa (sin vidrio: `bg-card`, sin desenfoque) y con un filete
      // arriba. Lo activo es una raya azul hondo sobre la pestaña, el mismo
      // gesto que las pestañas de las pantallas; la píldora celeste se fue.
      className="barra-secciones fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            data-tour={`nav-${href.slice(1)}`}
            // `replace` (no push): cambiar de pestaña NO apila historial, igual
            // que una app nativa. Antes cada tap sumaba una entrada y el botón
            // "atrás" retrocedía pestaña por pestaña (Perfil→Chats→Matches→...)
            // en vez de salir de la sección — el síntoma de "atrás va una
            // página atrás y nunca sale". La navegación a detalle (turno,
            // candidatos, chat) sigue con push, así que ahí "atrás" funciona
            // como se espera.
            replace
            // La pestaña activa se distinguía SÓLO por color: quien usa lector
            // de pantalla no tenía forma de saber en qué sección está (fase H,
            // mismo criterio que F4/jsx-a11y).
            aria-current={active ? "page" : undefined}
            // La raya va como borde de arriba de la pestaña, montada sobre el
            // filete de la barra (`-mt-px`). Las de reposo en `ink-soft` y no
            // en `ink/40`, que sobre el blanco daba 2,6 de contraste: el
            // nombre de una sección es texto y pide 4,5.
            className={`-mt-px flex min-w-0 flex-1 flex-col items-center gap-1 border-t-[3px] pb-2 pt-2 text-xs font-semibold transition-colors ${
              active ? "border-primary-text text-ink" : "border-transparent text-ink-soft"
            }`}
          >
            {/* Antes la activa llevaba una píldora celeste detrás del ícono
                (2026-10-19). La prueba de la app «con relieve» la cambió por
                la raya: sin píldoras en la interfaz. `aria-current` sigue
                siendo lo que anuncia el lector de pantalla. */}
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
