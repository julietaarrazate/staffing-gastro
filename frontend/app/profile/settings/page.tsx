"use client";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import AppearanceControl from "@/components/AppearanceControl";
import PushToggle from "@/components/PushToggle";
import { Row, RowGroup, SectionLabel, SubpageHeader } from "@/components/profile/ProfileParts";
import { LogOutIcon, MessageIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui";

/**
 * Ajustes de la app, juntos y fuera del perfil (sobrecarga visual,
 * 2026-09-30): el perfil dice cómo te ven; esto es cómo usás la app.
 */
export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const { logout } = useAuth();

  // Nada de esto se pinta en el servidor: `AppearanceControl` y `PushToggle`
  // leen el tema y el permiso del navegador, y pintarlos antes de tener la
  // sesión rompía la hidratación (React #418) y con ella el `data-theme`.
  // Mismo criterio que `/profile`, que espera a la sesión con un skeleton.
  if (loading || !user) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-10 pt-6" aria-hidden>
        <Skeleton className="h-5 w-16" />
        <Skeleton className="mt-4 h-8 w-32" />
        <Skeleton className="mt-8 h-20 w-full" />
        <Skeleton className="mt-8 h-44 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-6">
      <SubpageHeader title="Ajustes" />

      <div className="mt-6">
        <SectionLabel>Apariencia</SectionLabel>
        <div className="mt-2">
          <AppearanceControl />
        </div>
      </div>

      <div className="mt-7">
        <SectionLabel>Cuenta</SectionLabel>
        <div className="mt-2">
          <RowGroup>
            <PushToggle />
            {/* `/support` es "mis tickets" (GET /support/tickets/mine): para
                un admin es casi siempre una lista vacía, porque los tickets
                que importan son los que abren OTROS usuarios. Al admin lo
                manda al inbox real (/admin/support). */}
            <Row
              icon={<MessageIcon size={18} />}
              tone="cielo"
              href={user.role === "admin" ? "/admin/support" : "/support"}
            >
              Soporte
            </Row>
            <Row icon={<LogOutIcon size={18} />} tone="neutral" onClick={logout}>
              Cerrar sesión
            </Row>
          </RowGroup>
        </div>
      </div>
    </div>
  );
}
