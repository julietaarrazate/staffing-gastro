"use client";

import { useAuth } from "@/lib/auth-context";
import WorkerProfileForm from "@/components/WorkerProfileForm";
import CompanyProfileForm from "@/components/CompanyProfileForm";

export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) return <p className="px-4 py-16 text-center">Cargando...</p>;
  if (!user) return <p className="px-4 py-16 text-center">Iniciá sesión para ver tu perfil.</p>;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">
        {user.role === "worker" ? "Mi perfil de trabajador" : "Mi comercio"}
      </h1>
      <div className="mt-6">
        {user.role === "worker" ? <WorkerProfileForm /> : <CompanyProfileForm />}
      </div>
    </div>
  );
}
