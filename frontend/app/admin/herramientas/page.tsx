"use client";

// "Herramientas": cuentas de prueba para ver la app como trabajador o
// comercio sin usar datos de usuarios reales (reutiliza "Ver como" sobre 2
// cuentas que se crean solas la primera vez, `AdminService.get_or_create_test_accounts`).
// Antes ocupaban el primer lugar del panel.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import type { TestAccount } from "@/lib/types";
import { Button, Card, ErrorBanner, Skeleton } from "@/components/ui";
import { EyeIcon, FlaskIcon } from "@/components/icons";
import { AdminHeading } from "@/components/admin/AdminStats";

const TEST_ACCOUNT_ROLE_LABELS: Record<string, string> = {
  worker: "Ver como trabajador",
  employer: "Ver como comercio",
};

export default function AdminToolsPage() {
  const { token, impersonate } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<TestAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .get<TestAccount[]>("/admin/test-accounts", token)
      .then(setAccounts)
      .catch((err) => setError(getErrorMessage(err, "No se pudieron cargar las cuentas de prueba")));
  }, [token]);

  async function handleImpersonate(userId: string) {
    setBusy(userId);
    try {
      await impersonate(userId);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : getErrorMessage(err, "No se pudo entrar como este usuario")
      );
      setBusy(null);
    }
  }

  return (
    <div>
      <AdminHeading
        title="Herramientas"
        subtitle="Para probar la app sin tocar cuentas de usuarios reales."
      />
      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <Card className="mt-5 p-5">
        <div className="flex items-center gap-1.5">
          <FlaskIcon size={16} className="text-ink/50" />
          <p className="text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">
            Mis cuentas de prueba
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {accounts === null && !error ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            (accounts ?? []).map((account) => (
              <Button
                key={account.id}
                size="sm"
                variant="surface"
                leftIcon={<EyeIcon size={14} />}
                disabled={busy !== null}
                loading={busy === account.id}
                onClick={() => handleImpersonate(account.id)}
              >
                {TEST_ACCOUNT_ROLE_LABELS[account.role] ?? account.full_name}
              </Button>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
