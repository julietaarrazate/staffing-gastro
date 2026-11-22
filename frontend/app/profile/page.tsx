"use client";

import { useAuth } from "@/lib/auth-context";
import EditableName from "@/components/EditableName";
import PerfilComercio from "@/components/company/PerfilComercio";
import PerfilTrabajador from "@/components/worker/PerfilTrabajador";
import { Avatar, Skeleton } from "@/components/ui";
import { FilaSuave, FilasSuaves } from "@/components/profile/ProfileParts";

/**
 * Perfil = cómo te ven (sobrecarga visual, 2026-09-30). Antes esta pantalla
 * era también el formulario de edición entero y los ajustes de la app: 4,2
 * pantallas de alto para el trabajador y 3,2 para el comercio, con datos
 * repetidos (el nivel dos veces, los años de experiencia como dato y como
 * campo, la dirección cuatro veces). La edición vive en `/profile/edit` y
 * apariencia, notificaciones, soporte y cerrar sesión en `/profile/settings`.
 */
export default function ProfilePage() {
  const { user, loading } = useAuth();
  if (loading) {
    // Mismo estilo de skeleton que el resto de la app (batch C3,
    // docs/planning/PULIDO_ROADMAP.md: "un solo estilo de skeleton, en vez
    // de spinners mixtos") — antes un spinner centrado tapaba toda la
    // pantalla y después aparecía de golpe el layout completo. Forma
    // aproximada (no sabemos todavía si el rol es trabajador/comercio/
    // admin) para que la transición sea progresiva, no un pop-in.
    return (
      <div className="mx-auto max-w-xl px-4 py-8 lg:max-w-5xl" aria-hidden>
        <Skeleton className="h-8 w-24" />
        <div className="mt-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-[86px] w-full" />
            <Skeleton className="mt-7 h-48 w-full" />
          </div>
          <div className="mt-7 lg:mt-0">
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }
  if (!user)
    return <p className="px-4 py-16 text-center text-ink-soft">Iniciá sesión para ver tu perfil.</p>;

  // Quien trabaja ve su perfil con la dirección suave (ADR-0028): el cielo, la
  // foto a caballo de la hoja y la reputación en grande. Lo de abajo es el
  // perfil del comercio y el del admin, que todavía no migraron.
  if (user.role === "worker") return <PerfilTrabajador />;
  // El comercio también (2026-11-21, sin maqueta: con las mismas piezas). Lo de
  // abajo queda sólo para el admin, que migra con el resto de Administración.
  if (user.role === "employer") return <PerfilComercio />;

  // El admin (2026-11-21): la misma cáscara que la Administración, el cielo
  // corto y liso con el título y debajo la hoja (`PantallaAdmin`).
  return (
    <div className="estilo-suave mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col md:min-h-[calc(100dvh-var(--chrome-top))] md:max-w-xl md:px-4 md:pt-4">
      <div className="app-cielo cielo-limpio px-4 pb-12 pt-5 md:rounded-t-[28px] md:px-6">
        {/* F2 (auditoría de producto/UI 2026-08-09): la pantalla tiene su <h1>
            para la navegación por headings. */}
        <h1 className="titulo-pantalla">Perfil</h1>
      </div>
      <div className="hoja -mt-7 flex-1 px-4 pb-8 pt-6 md:px-6">
        <div className="tarjeta-suave flex items-center gap-4 p-5">
          <Avatar name={user.full_name} size="lg" cielo />
          <div className="min-w-0">
            <EditableName className="text-lg font-bold text-ink" />
            <p className="break-all text-sm text-ink-soft">{user.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="chip-suave">Administrador</span>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <FilasSuaves>
            <FilaSuave href="/profile/settings">Ajustes</FilaSuave>
          </FilasSuaves>
        </div>
      </div>
    </div>
  );
}
