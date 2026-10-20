"use client";

// "Verificación": la cola de DNI y constancias de AFIP. Antes estaba al
// final del panel de una sola página, debajo de todas las métricas.

import IdentityReviewQueue from "@/components/admin/IdentityReviewQueue";
import { AdminHeading } from "@/components/admin/AdminStats";

export default function AdminVerificationPage() {
  return (
    <div>
      <AdminHeading
        title="Verificación"
        subtitle="DNI y selfie de trabajadores, constancia de AFIP de comercios."
      />
      <IdentityReviewQueue />
    </div>
  );
}
