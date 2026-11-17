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
      className="flex items-start justify-between gap-3 bg-night px-4 py-2 text-sm text-white"
    >
      {/* Texto corrido que parte línea: antes `truncate` en el <strong>
          lo dejaba sin ancho y en el celular el nombre desaparecía (U131). */}
      <span className="min-w-0 flex-1 break-words">
        <EyeIcon size={15} className="mr-1.5 inline-block shrink-0 align-[-2px]" />
        Viendo como <strong className="break-words">{user.full_name}</strong>
        {" "}({ROLE_LABELS[user.role] ?? user.role}) — sesión de{" "}
        {impersonating.adminUser.full_name}
      </span>
      <button
        type="button"
        onClick={stopImpersonating}
        className="shrink-0 self-center rounded-full bg-white/15 px-3 py-1 font-semibold transition hover:bg-white/25 active:scale-95"
      >
        Volver a admin
      </button>
    </div>
  );
}
