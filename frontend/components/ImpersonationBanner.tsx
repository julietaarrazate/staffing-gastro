"use client";

import { useAuth } from "@/lib/auth-context";
import { EyeIcon } from "@/components/icons";

const ROLE_LABELS: Record<string, string> = {
  worker: "trabajador",
  employer: "comercio",
  admin: "admin",
};

/**
 * Banner de "Viendo como" — visible mientras una admin impersona a otro
 * usuario para testing/soporte (`useAuth().impersonate`). No es sticky a
 * propósito: alcanza con que sea lo primero que se ve al entrar a cada
 * pantalla; scrollea con el contenido, el Navbar (sticky) queda debajo.
 */
export default function ImpersonationBanner() {
  const { user, impersonating, stopImpersonating } = useAuth();
  if (!impersonating || !user) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 bg-night px-4 py-2 text-sm text-white"
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
        <EyeIcon size={15} className="shrink-0" />
        Viendo como <strong className="truncate">{user.full_name}</strong>
        {" "}({ROLE_LABELS[user.role] ?? user.role}) — sesión de{" "}
        {impersonating.adminUser.full_name}
      </span>
      <button
        type="button"
        onClick={stopImpersonating}
        className="shrink-0 rounded-full bg-white/15 px-3 py-1 font-semibold transition hover:bg-white/25 active:scale-95"
      >
        Volver a admin
      </button>
    </div>
  );
}
