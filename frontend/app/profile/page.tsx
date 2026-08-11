"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import WorkerProfileForm from "@/components/WorkerProfileForm";
import IdentityVerificationCard from "@/components/worker/IdentityVerificationCard";
import CompanyProfileForm from "@/components/CompanyProfileForm";
import EditableName from "@/components/EditableName";
import WorkerGameCard from "@/components/worker/WorkerGameCard";
import ReceivedReviews from "@/components/ReceivedReviews";
import PushToggle from "@/components/PushToggle";
import { Skeleton } from "@/components/ui";
import {
  ChevronRightIcon,
  CreditCardIcon,
  HeartIcon,
  LogOutIcon,
  MessageIcon,
} from "@/components/icons";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-xs font-semibold uppercase tracking-wide text-ink/40">
      {children}
    </p>
  );
}

function Row({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition first:rounded-t-[var(--radius-card)] last:rounded-b-[var(--radius-card)] hover:bg-surface active:bg-surface disabled:hover:bg-transparent"
      disabled={!onClick}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-ink/50">
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium text-ink">{children}</span>
      {/* Affordance de fila tocable (sensación de app nativa): sin esto las
          filas parecían texto suelto y no se leía que llevaban a otro lado. */}
      {onClick && <ChevronRightIcon size={17} className="shrink-0 text-ink/25" />}
    </button>
  );
}

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

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
    return <p className="px-4 py-16 text-center text-ink/50">Iniciá sesión para ver tu perfil.</p>;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 lg:max-w-5xl">
      {/* F2 (auditoría de producto/UI 2026-08-09): la pantalla no tenía
          ningún <h1> — rompía la navegación por headings (tecla H en
          lectores de pantalla) en una de las pantallas más usadas de la
          app. Mismo patrón visual que el resto de las pantallas (`/shifts`,
          `/feed`, etc.). */}
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Perfil</h1>
      {/* En lg+ el formulario principal queda en una columna angosta y
          legible (ensanchar los inputs a todo el ancho se ve mal, mismo
          criterio que /my-shifts al no forzar una altura pareja en
          ShiftCard) mientras las secciones secundarias pasan a una columna
          al lado, en vez de apilarse debajo con media pantalla vacía a los
          costados. Sin `lg:grid`, en mobile/tablet sigue siendo un único
          stack en el mismo orden de siempre. */}
      <div className="mt-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="lg:col-span-2">
          {user.role === "worker" ? (
            <WorkerGameCard />
          ) : (
            <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xl font-bold text-primary-text">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <EditableName className="font-display text-lg font-semibold text-ink" />
                <p className="truncate text-sm text-ink/50">{user.email}</p>
                <span className="mt-1 inline-block rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink/60">
                  {user.role === "admin" ? "Administrador" : "Comercio"}
                </span>
              </div>
            </div>
          )}

          {/* Un admin no tiene perfil de trabajador ni comercio propio — antes
              caía en la rama "no worker" y renderizaba `CompanyProfileForm`
              (que pega a /companies/me, 403 para un admin sin comercio:
              "Permisos insuficientes" en pantalla, reporte real de Julieta
              probando su propia cuenta). */}
          {user.role !== "admin" && (
            <div className="mt-7">
              <SectionLabel>{user.role === "worker" ? "Mi perfil" : "Mi comercio"}</SectionLabel>
              <div className="mt-2 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-soft)] ring-1 ring-line">
                {user.role === "worker" ? <WorkerProfileForm /> : <CompanyProfileForm />}
              </div>
            </div>
          )}
        </div>

        <div>
          {user.role === "employer" && (
            <div className="mt-7 lg:mt-0">
              <SectionLabel>Suscripción</SectionLabel>
              <div className="mt-2 rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line">
                <Row
                  icon={<CreditCardIcon size={18} />}
                  onClick={() => router.push("/subscription")}
                >
                  Mi plan
                </Row>
                <Row
                  icon={<HeartIcon size={18} />}
                  onClick={() => router.push("/favorites")}
                >
                  Trabajadores favoritos
                </Row>
              </div>
            </div>
          )}

          {user.role === "worker" && (
            <div className="mt-7 lg:mt-0">
              <SectionLabel>Identidad</SectionLabel>
              <div className="mt-2 rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line">
                <IdentityVerificationCard />
              </div>
            </div>
          )}

          {user.role !== "admin" && (
            <div className="mt-7">
              <SectionLabel>Reseñas recibidas</SectionLabel>
              <div className="mt-2 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-soft)] ring-1 ring-line">
                <ReceivedReviews />
              </div>
            </div>
          )}

          <div className="mt-7">
            <SectionLabel>Otros</SectionLabel>
            {/* El ítem "Verificación" que estaba acá (batch C0 #4) sólo mostraba
                `user.is_verified` sin ninguna acción: no existe un flujo de
                verificación de identidad iniciado por el usuario, `is_verified`
                se marca desde el panel de admin (`POST /admin/users/{id}/verify`,
                ver backend/app/modules/admin) y no hay endpoint para que el
                propio usuario la solicite. Era UI muerta (un ítem de menú junto
                a "Cerrar sesión" que no hacía nada al tocarlo) así que se oculta
                acá; el estado de verificación del trabajador ya es visible como
                insignia "Perfil Verificado" en `WorkerGameCard` (ver
                `lib/reputation.tsx`) cuando corresponde. */}
            <div className="mt-2 divide-y divide-line rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line">
              <PushToggle />
              {/* `/support` es "mis tickets" (GET /support/tickets/mine) — para un
                  admin eso es casi siempre una lista vacía, porque los tickets que
                  importa ver son los que abren OTROS usuarios. Confusión real de
                  Julieta: abrió un ticket de prueba como trabajador y no lo veía
                  "en su perfil de admin" porque este ítem la mandaba a /support en
                  vez de al inbox real (/admin/support, GET /support/tickets). */}
              <Row
                icon={<MessageIcon size={18} />}
                onClick={() =>
                  router.push(user.role === "admin" ? "/admin/support" : "/support")
                }
              >
                Soporte
              </Row>
              <Row icon={<LogOutIcon size={18} />} onClick={logout}>
                Cerrar sesión
              </Row>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
