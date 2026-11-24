"use client";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import AppearanceControl from "@/components/AppearanceControl";
import PushToggle from "@/components/PushToggle";
import { FilaSuave, FilasSuaves, SubpaginaSuave } from "@/components/profile/ProfileParts";
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
      <SubpaginaSuave formulario title="">
        <div aria-hidden>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="mt-8 h-44 w-full" />
        </div>
      </SubpaginaSuave>
    );
  }

  // La dirección suave (ADR-0028, 2026-11-20): el cielo corto con la vuelta y
  // el título; en la hoja, la apariencia y la cuenta como filas suaves, sin
  // íconos de colores.
  return (
    <SubpaginaSuave formulario title="Ajustes">
      <h2 className="titulo-seccion">Apariencia</h2>
      <div className="mt-3">
        <AppearanceControl />
      </div>

      <h2 className="titulo-seccion mt-8">Cuenta</h2>
      <div className="mt-3">
        <FilasSuaves>
          <PushToggle />
          {/* `/support` es "mis tickets" (GET /support/tickets/mine): para
              un admin es casi siempre una lista vacía, porque los tickets
              que importan son los que abren OTROS usuarios. Al admin lo
              manda al inbox real (/admin/support). */}
          <FilaSuave href={user.role === "admin" ? "/admin/support" : "/support"}>Soporte</FilaSuave>
          {/* Verificación en dos pasos, obligatoria para admin (ADR-0023). */}
          {user.role === "admin" && <FilaSuave href="/admin/seguridad">Verificación en dos pasos</FilaSuave>}
          <FilaSuave onClick={logout}>Cerrar sesión</FilaSuave>
        </FilasSuaves>
      </div>
    </SubpaginaSuave>
  );
}
