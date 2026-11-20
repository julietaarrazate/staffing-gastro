"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRequireAuth } from "@/lib/use-require-auth";
import WorkerProfileForm from "@/components/WorkerProfileForm";
import CompanyProfileForm from "@/components/CompanyProfileForm";
import { SubpaginaSuave } from "@/components/profile/ProfileParts";
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
      <SubpaginaSuave title="">
        <div aria-hidden>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="mt-5 h-64 w-full" />
        </div>
      </SubpaginaSuave>
    );
  }

  const isWorker = user.role === "worker";

  return (
    // La dirección suave (ADR-0028, 2026-11-20): el cielo corto con la vuelta
    // y el título, y el formulario directo sobre la hoja (antes, una tarjeta
    // con filete sobre el lienzo).
    <SubpaginaSuave title={isWorker ? "Editar perfil" : "Datos del comercio"}>
      {isWorker ? <WorkerProfileForm /> : user.role === "employer" ? <CompanyProfileForm /> : null}
    </SubpaginaSuave>
  );
}
