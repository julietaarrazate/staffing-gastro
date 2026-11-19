// «Altas por origen» de "Métricas" (fase 0 del plan de crecimiento,
// 2026-11-18): las cuentas nuevas del período según el enlace con el que
// llegaron (`?ref=` o `utm_*`; «directo» sin ninguno) y por rol. Las cuentas
// de prueba e invitadas no cuentan. La etiqueta la arma el backend
// (`identity/domain/origen_alta.py`).

import { Card } from "@/components/ui";
import { SectionLabel } from "@/components/admin/AdminStats";
import type { SignupsByOrigin } from "@/lib/types";

export const SIN_DATO = "Sin dato";

/** Lo que se muestra en la columna «Origen». */
export function etiquetaOrigen(origin: string | null): string {
  return origin ?? SIN_DATO;
}

export default function AltasPorOrigen({ filas }: { filas: SignupsByOrigin[] }) {
  const total = filas.reduce((suma, f) => suma + f.total, 0);
  const haySinDato = filas.some((f) => f.origin === null);
  return (
    <div className="mt-6" data-testid="altas-por-origen">
      <SectionLabel>Altas por origen</SectionLabel>
      <Card className="mt-2 p-0">
        {filas.length === 0 ? (
          <p className="p-5 text-sm text-ink/60">Ninguna cuenta nueva en el período.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Cuentas nuevas del período por origen y por rol</caption>
            <thead>
              <tr className="text-left text-xs font-medium text-ink/50">
                <th scope="col" className="px-4 pb-2 pt-4 font-medium sm:px-5">Origen</th>
                <th scope="col" className="px-2 pb-2 pt-4 text-right font-medium">Trabajadores</th>
                <th scope="col" className="px-2 pb-2 pt-4 text-right font-medium">Comercios</th>
                <th scope="col" className="px-4 pb-2 pt-4 text-right font-medium sm:px-5">Total</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.origin ?? "__sin_dato__"} className="border-t border-line">
                  <th
                    scope="row"
                    className={`max-w-[10rem] break-words px-4 py-2 text-left font-medium sm:max-w-none sm:px-5 ${
                      f.origin === null ? "text-ink/50" : "text-ink"
                    }`}
                  >
                    {etiquetaOrigen(f.origin)}
                  </th>
                  <td className="px-2 py-2 text-right tabular-nums text-ink/75">{f.workers}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink/75">{f.companies}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-ink sm:px-5">
                    {f.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line">
                <th scope="row" className="px-4 pb-4 pt-2 text-left font-semibold text-ink sm:px-5">
                  Total
                </th>
                <td className="px-2 pb-4 pt-2 text-right tabular-nums text-ink/75">
                  {filas.reduce((suma, f) => suma + f.workers, 0)}
                </td>
                <td className="px-2 pb-4 pt-2 text-right tabular-nums text-ink/75">
                  {filas.reduce((suma, f) => suma + f.companies, 0)}
                </td>
                <td className="px-4 pb-4 pt-2 text-right font-extrabold tabular-nums text-ink sm:px-5">
                  {total}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>
      <p className="mt-1.5 px-1 text-xs text-ink/40">
        Cuentas nuevas del período según el enlace con el que llegaron (?ref= o utm). «directo»:
        entraron sin un enlace con código.
        {haySinDato && " «Sin dato»: cuentas creadas antes de que se guardara el origen."}
      </p>
    </div>
  );
}
