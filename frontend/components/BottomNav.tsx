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
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading || !user) return null;
  // El onboarding es una pantalla de configuración inicial a pantalla completa:
  // la barra tapaba su botón principal, y navegar a otra sección antes de
  // terminar deja el perfil a medias (sin zona ni oficio el feed no sirve).
  if (pathname === "/bienvenida") return null;

  const tabs = TABS_BY_ROLE[user.role] ?? EMPLOYER_TABS;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-chrome pb-[env(safe-area-inset-bottom)] md:hidden">
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
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              active ? "text-primary-text" : "text-ink/40"
            }`}
          >
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
