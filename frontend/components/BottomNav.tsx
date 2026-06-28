"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  ClipboardIcon,
  HomeIcon,
  MapPinIcon,
  MessageIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";

const WORKER_TABS = [
  { href: "/feed", label: "Inicio", Icon: HomeIcon },
  { href: "/my-shifts", label: "Matches", Icon: ClipboardIcon },
  { href: "/chats", label: "Chats", Icon: MessageIcon },
  { href: "/profile", label: "Perfil", Icon: UsersIcon },
];

const EMPLOYER_TABS = [
  { href: "/shifts", label: "Mis turnos", Icon: ClipboardIcon },
  { href: "/search", label: "Buscar", Icon: MapPinIcon },
  { href: "/chats", label: "Mensajes", Icon: MessageIcon },
  { href: "/profile", label: "Comercio", Icon: UsersIcon },
];

const ADMIN_TABS = [
  { href: "/admin", label: "Panel", Icon: ShieldIcon },
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

  const tabs = TABS_BY_ROLE[user.role] ?? EMPLOYER_TABS;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
              active ? "text-orange-600" : "text-zinc-400"
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
