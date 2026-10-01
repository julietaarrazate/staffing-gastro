"use client";

import { useAuth } from "@/lib/auth-context";
import AvailableNowToggle from "@/components/worker/AvailableNowToggle";
import IdentityVerificationCard from "@/components/worker/IdentityVerificationCard";
import BusinessVerificationCard from "@/components/company/BusinessVerificationCard";
import EditableName from "@/components/EditableName";
import WorkerGameCard from "@/components/worker/WorkerGameCard";
import IdentityVerifiedBadge from "@/components/IdentityVerifiedBadge";
import ReceivedReviews from "@/components/ReceivedReviews";
import { Row, RowGroup } from "@/components/profile/ProfileParts";
import { Skeleton } from "@/components/ui";
import {
  BuildingIcon,
  CreditCardIcon,
  HeartIcon,
  PencilIcon,
  SettingsIcon,
} from "@/components/icons";

/**
 * Perfil = cómo te ven (sobrecarga visual, 2026-09-30). Antes esta pantalla
 * era también el formulario de edición entero y los ajustes de la app: 4,2
 * pantallas de alto para el trabajador y 3,2 para el comercio, con datos
 * repetidos (el nivel dos veces, los años de experiencia como dato y como
 * campo, la dirección cuatro veces). La edición vive en `/profile/edit` y
 * apariencia, notificaciones, soporte y cerrar sesión en `/profile/settings`.
 */
export default function ProfilePage() {
  const { user, token, loading } = useAuth();

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
          app. */}
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">Perfil</h1>
      {/* En lg+ la tarjeta principal ocupa dos columnas y lo demás va al
          costado, en vez de apilarse debajo con media pantalla vacía a los
          costados. En mobile/tablet es un único stack. */}
      <div className="mt-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="lg:col-span-2">
          {user.role === "worker" ? (
            <WorkerGameCard />
          ) : (
            <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xl font-bold text-primary-text">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <EditableName className="font-display text-lg font-semibold text-ink" />
                <p className="truncate text-sm text-ink/50">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-block rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink/60">
                    {user.role === "admin" ? "Administrador" : "Comercio"}
                  </span>
                  <IdentityVerifiedBadge verified={user.is_verified} />
                </div>
              </div>
            </div>
          )}

          {/* La verificación va arriba: mientras no está aprobada es lo que
              destraba todo, y una vez aprobada la tarjeta se achica sola a
              un sello (ver `IdentityVerificationCard` y
              `BusinessVerificationCard`). Celeste y no `bg-card`: es una
              pieza de confianza, no una tarjeta de contenido más. */}
          {user.role !== "admin" && (
            <div className="mt-4 rounded-[var(--radius-card)] bg-cielo-tint shadow-[var(--shadow-soft)]">
              {user.role === "worker" ? <IdentityVerificationCard /> : <BusinessVerificationCard />}
            </div>
          )}

          {user.role === "worker" && (
            <div className="mt-4">
              <AvailableNowToggle token={token} />
            </div>
          )}
        </div>

        <div>
          <div className="mt-7 lg:mt-0">
            <RowGroup>
              {user.role === "worker" && (
                <Row icon={<PencilIcon size={18} />} tone="manteca" href="/profile/edit">
                  Editar perfil
                </Row>
              )}
              {user.role === "employer" && (
                <>
                  <Row icon={<BuildingIcon size={18} />} tone="manteca" href="/profile/edit">
                    Datos del comercio
                  </Row>
                  <Row icon={<CreditCardIcon size={18} />} tone="secondary" href="/subscription">
                    Mi plan
                  </Row>
                  <Row icon={<HeartIcon size={18} />} tone="danger" href="/favorites">
                    Trabajadores favoritos
                  </Row>
                </>
              )}
              <Row icon={<SettingsIcon size={18} />} tone="neutral" href="/profile/settings">
                Ajustes
              </Row>
            </RowGroup>
          </div>

          {/* Sin reseñas no se muestra nada: una sección que dice
              "Todavía no tenés reseñas" es otra cosa que le cuenta a la
              persona nueva lo que no tiene. */}
          {user.role !== "admin" && (
            <div className="mt-7">
              <ReceivedReviews />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
