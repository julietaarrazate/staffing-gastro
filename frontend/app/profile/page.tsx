"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import WorkerProfileForm from "@/components/WorkerProfileForm";
import CompanyProfileForm from "@/components/CompanyProfileForm";
import WorkerGameCard from "@/components/worker/WorkerGameCard";
import ReceivedReviews from "@/components/ReceivedReviews";
import PushToggle from "@/components/PushToggle";
import { Spinner } from "@/components/ui";
import { ChevronRightIcon, CreditCardIcon, LogOutIcon } from "@/components/icons";

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
    return (
      <div className="flex justify-center px-4 py-16">
        <Spinner size={28} className="text-ink/40" />
      </div>
    );
  }
  if (!user)
    return <p className="px-4 py-16 text-center text-ink/50">Iniciá sesión para ver tu perfil.</p>;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {user.role === "worker" ? (
        <WorkerGameCard />
      ) : (
        <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xl font-bold text-primary-text">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink">{user.full_name}</h1>
            <p className="truncate text-sm text-ink/50">{user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink/60">
              Comercio
            </span>
          </div>
        </div>
      )}

      <div className="mt-7">
        <SectionLabel>{user.role === "worker" ? "Mi perfil" : "Mi comercio"}</SectionLabel>
        <div className="mt-2 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-soft)] ring-1 ring-line">
          {user.role === "worker" ? <WorkerProfileForm /> : <CompanyProfileForm />}
        </div>
      </div>

      {user.role === "employer" && (
        <div className="mt-7">
          <SectionLabel>Suscripción</SectionLabel>
          <div className="mt-2 rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line">
            <Row icon={<CreditCardIcon size={18} />} onClick={() => router.push("/subscription")}>
              Mi plan
            </Row>
          </div>
        </div>
      )}

      <div className="mt-7">
        <SectionLabel>Reseñas recibidas</SectionLabel>
        <div className="mt-2 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-soft)] ring-1 ring-line">
          <ReceivedReviews />
        </div>
      </div>

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
          <Row icon={<LogOutIcon size={18} />} onClick={logout}>
            Cerrar sesión
          </Row>
        </div>
      </div>
    </div>
  );
}
