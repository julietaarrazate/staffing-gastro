"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAvisos } from "@/lib/avisos";
import { estaPublicando } from "@/lib/publicando";
import { CuentaAvisos } from "@/components/NotificationBell";
import {
  ClipboardIcon,
  HomeIcon,
  MapPinIcon,
  MessageIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";

type Tab = {
  href: string;
  label: string;
  Icon: typeof HomeIcon;
  /** Otras pantallas que viven bajo esta pestaña. */
  tambien?: string[];
};

// Cinco pestañas (Julieta, 2026-11-20): Buscar y el Mapa son una sola, con un
// conmutador Lista / Mapa en la pantalla (`worker/ListaMapa`), y «Matches»
// pasó a llamarse «Turnos».
const WORKER_TABS: Tab[] = [
  { href: "/feed", label: "Inicio", Icon: HomeIcon },
  { href: "/buscar", label: "Buscar", Icon: SearchIcon, tambien: ["/map"] },
  { href: "/my-shifts", label: "Turnos", Icon: ClipboardIcon },
  { href: "/chats", label: "Chats", Icon: MessageIcon },
  { href: "/profile", label: "Perfil", Icon: UsersIcon },
];

const EMPLOYER_TABS: Tab[] = [
  { href: "/shifts", label: "Panel", Icon: HomeIcon },
  { href: "/search", label: "Buscar", Icon: MapPinIcon },
  { href: "/chats", label: "Chats", Icon: MessageIcon },
  { href: "/profile", label: "Perfil", Icon: UsersIcon },
];

const ADMIN_TABS: Tab[] = [
  { href: "/admin", label: "Panel", Icon: ShieldIcon },
  { href: "/map", label: "Mapa", Icon: MapPinIcon },
  { href: "/search", label: "Buscar", Icon: SearchIcon },
  { href: "/profile", label: "Perfil", Icon: UsersIcon },
];

const TABS_BY_ROLE: Record<string, Tab[]> = {
  worker: WORKER_TABS,
  employer: EMPLOYER_TABS,
  admin: ADMIN_TABS,
};

export default function BottomNav() {
  const { user, loading, twoFactorSetupPending } = useAuth();
  const { unreadCount } = useAvisos();
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
  const conMas = user.role === "employer" && !estaPublicando(pathname);
  // La campanita está sólo en el Inicio y en el Panel (y el admin la conserva
  // en su encabezado): en las demás pantallas la cuenta de avisos sin leer va
  // sobre esa pestaña, que es por donde se llega a ellos.
  const inicio = user.role === "admin" ? null : tabs[0].href;

  return (
    // La barra flota (Julieta, 2026-11-20; ADR-0028): una píldora blanca con
    // sombra difusa, separada de los bordes. El contenedor no recibe toques:
    // por los costados y por debajo de la píldora se toca lo que hay detrás.
    <div className="barra-app md:hidden print:hidden">
      {/* `aria-label`: en la compu vive también el `<nav>` de la barra de
          arriba, y sin nombre un lector de pantalla anuncia «navegación,
          navegación» sin forma de distinguirlas (auditoría de navegación,
          fase H). */}
      <nav aria-label="Secciones" className="barra-app-pildora">
        {tabs.map(({ href, label, Icon, tambien = [] }, i) => {
          const active = [href, ...tambien].some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
          // Coincidencia exacta: en una pantalla de adentro (publicar,
          // candidatos) la pestaña está activa pero no hay campanita.
          const avisos = href === inicio && pathname !== href ? unreadCount : 0;
          return (
            <Fragment key={href}>
              {/* «Publicar turno» del comercio: el «+» redondo azul hondo en el
                  centro de la píldora (Julieta, 2026-11-21, reemplaza al «+» al
                  costado de #712), dos pestañas de cada lado. Sobresale unos
                  10 px por arriba. No va en ámbar: el ámbar es de la acción de
                  cada pantalla. */}
              {conMas && i === tabs.length / 2 && (
                <Link href="/shifts/new" aria-label="Publicar turno" data-tour="shifts-publish" className="barra-app-mas">
                  <PlusIcon size={26} strokeWidth={2.2} />
                </Link>
              )}
              <Link
                data-tour={`nav-${href.slice(1)}`}
                href={href}
                // `replace` (no push): cambiar de pestaña NO apila historial, igual
                // que una app nativa. Antes cada tap sumaba una entrada y el botón
                // "atrás" retrocedía pestaña por pestaña (Perfil→Chats→Matches→...)
                // en vez de salir de la sección — el síntoma de "atrás va una
                // página atrás y nunca sale". La navegación a detalle (turno,
                // candidatos, chat) sigue con push, así que ahí "atrás" funciona
                // como se espera.
                replace
                // La pestaña activa no se distingue SÓLO por color: quien usa
                // lector de pantalla tiene que saber en qué sección está (fase H,
                // mismo criterio que F4/jsx-a11y).
                aria-current={active ? "page" : undefined}
                aria-label={avisos > 0 ? `${label}, ${avisos} ${avisos === 1 ? "aviso" : "avisos"} sin leer` : undefined}
                className="barra-app-pestana"
              >
                {/* La activa: un óvalo celeste detrás del ícono. */}
                <span className="barra-app-icono">
                  <Icon size={22} />
                  <CuentaAvisos cuantos={avisos} className="absolute -top-1 right-0" />
                </span>
                {label}
              </Link>
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
}
