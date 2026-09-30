"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRequireAuth } from "@/lib/use-require-auth";
import WorkerProfileForm from "@/components/WorkerProfileForm";
import CompanyProfileForm from "@/components/CompanyProfileForm";
import { SubpageHeader } from "@/components/profile/ProfileParts";
import { Skeleton } from "@/components/ui";

/**
 * Edición del perfil, en su propia pantalla (sobrecarga visual, 2026-09-30).
 * Antes el formulario entero vivía adentro de `/profile`, debajo de la
 * tarjeta que ya mostraba los mismos datos. Se llega desde "Editar perfil"
 * (trabajador) o "Datos del comercio" (comercio).
 */
export default function EditProfilePage() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();

  // Un admin no tiene perfil de trabajador ni de comercio: el formulario del
  // comercio le daría 403 ("Permisos insuficientes").
  useEffect(() => {
    if (user?.role === "admin") router.replace("/profile");
  }, [user, router]);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-10 pt-6" aria-hidden>
        <Skeleton className="h-5 w-16" />
        <Skeleton className="mt-4 h-8 w-48" />
        <Skeleton className="mt-4 h-96 w-full" />
      </div>
    );
  }

  const isWorker = user.role === "worker";

  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-6">
      <SubpageHeader title={isWorker ? "Editar perfil" : "Datos del comercio"} />
      <div className="mt-4 rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)] ring-1 ring-line">
        {isWorker ? (
          <WorkerProfileForm />
        ) : user.role === "employer" ? (
          <CompanyProfileForm />
        ) : null}
      </div>
    </div>
  );
}
