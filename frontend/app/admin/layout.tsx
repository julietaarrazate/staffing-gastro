"use client";

// Panel de admin ordenado por secciones (pedido de Julieta, 2026-10-20: "muy
// genérico y poco ordenado"). Antes era una sola página larga con métricas,
// cola de verificación y usuarios mezclados; ahora cada sección responde una
// sola pregunta (la regla de producto del 2026-09-28) y el menú muestra
// cuántos pendientes hay. El control de acceso vive acá, una sola vez.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { EmptyState, OidoLoader } from "@/components/ui";
import { ShieldIcon } from "@/components/icons";
import { AdminInboxProvider, formatCount, useAdminInbox } from "@/components/admin/AdminInbox";
import type { AdminInbox } from "@/components/admin/AdminInbox";

type NavItem = {
  href: string;
  label: string;
  badge?: (inbox: AdminInbox) => string | null;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Hoy" },
  {
    href: "/admin/en-vivo",
    label: "Turnos en vivo",
    badge: (i) => (i.urgentUncovered ? formatCount(i.urgentUncovered, Infinity) : null),
  },
  { href: "/admin/personas", label: "Personas" },
  {
    href: "/admin/verificacion",
    label: "Verificación",
    badge: (i) => (i.identities ? formatCount(i.identities, Infinity) : null),
  },
  {
    href: "/admin/support",
    label: "Soporte",
    badge: (i) => (i.openTickets ? formatCount(i.openTickets) : null),
  },
  { href: "/admin/leads", label: "Crecimiento" },
  { href: "/admin/metricas", label: "Métricas" },
  { href: "/admin/herramientas", label: "Herramientas" },
  // Verificación en dos pasos de la cuenta (ADR-0023).
  { href: "/admin/seguridad", label: "Seguridad" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNav({ pathname }: { pathname: string }) {
  const { inbox } = useAdminInbox();
  return (
    <nav aria-label="Secciones del panel" className="md:w-52 md:shrink-0">
      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:sticky md:top-24 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const badge = item.badge?.(inbox) ?? null;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex items-center justify-between gap-2 rounded-full bg-raised px-3.5 py-2 text-sm font-semibold text-ink shadow-[var(--shadow-soft)] ring-1 ring-ink/40 md:rounded-[var(--radius-btn)]"
                    : "flex items-center justify-between gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-ink/60 ring-1 ring-line transition hover:bg-surface md:rounded-[var(--radius-btn)] md:ring-0"
                }
              >
                {item.label}
                {badge && (
                  <span className="rounded-full bg-danger-tint px-1.5 text-xs font-bold text-danger-text">
                    {badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, token, loading } = useRequireAuth();
  // Admin sin la verificación en dos pasos (ADR-0023): el backend le
  // responde 403 a todo lo de admin y `AuthProvider` la trae a
  // /admin/seguridad. Mientras tanto, ni menú ni contadores: sólo el alta.
  const { twoFactorSetupPending } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex justify-center px-4 py-16">
        <OidoLoader label="Cargando el panel…" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <EmptyState
          icon={<ShieldIcon size={26} />}
          title="Acceso restringido"
          subtitle="Esta sección es sólo para administradores."
        />
      </div>
    );
  }

  return (
    <AdminInboxProvider token={twoFactorSetupPending ? null : token} refreshKey={pathname}>
      <div className="app-container px-4 pb-10 pt-6">
        <p className="flex items-center gap-1.5 text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">
          <ShieldIcon size={14} /> Administración
        </p>
        <div className="mt-3 md:flex md:gap-8">
          {/* Mismo árbol con o sin menú: al terminar el alta aparece el menú
              y la pantalla no se remonta (perdería los códigos a la vista). */}
          {!twoFactorSetupPending && <AdminNav pathname={pathname} />}
          <div className="mt-5 min-w-0 flex-1 md:mt-0">{children}</div>
        </div>
      </div>
    </AdminInboxProvider>
  );
}
