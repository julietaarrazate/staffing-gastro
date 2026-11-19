// Versión para papel de la lista de «Comercios a captar»: la ruta de visitas
// para llevar impresa o guardar como PDF desde el diálogo de impresión del
// navegador. Va oculta en pantalla y sólo se ve al imprimir. Al imprimir la
// página pasa a tema claro (`beforeprint`) y después vuelve al que tenía
// (`afterprint`), así sale letra oscura sobre blanco aunque la app esté oscura
// sin duplicar los tokens de la paleta en el CSS.

"use client";

import { useEffect } from "react";
import type { Lead } from "@/lib/types";
import { LEAD_KIND_LABELS, LEAD_STATUS_LABELS } from "@/lib/leads";
import { formatShiftDate } from "@/lib/datetime";
import { plural } from "@/lib/format";

function useTemaClaroAlImprimir() {
  useEffect(() => {
    const root = document.documentElement;
    let guardado: string | null = null;
    let activo = false;
    const antes = () => {
      if (activo) return;
      activo = true;
      guardado = root.getAttribute("data-theme");
      root.setAttribute("data-theme", "light");
    };
    const despues = () => {
      if (!activo) return;
      activo = false;
      if (guardado === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", guardado);
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", despues);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", despues);
      despues();
    };
  }, []);
}

export default function ComerciosImprimir({
  leads,
  barrio,
  filtro,
}: {
  leads: Lead[];
  barrio: string;
  /** Etiqueta del filtro de estado ya elegido ("Todos", "Nuevo", …). */
  filtro: string;
}) {
  useTemaClaroAlImprimir();
  // Fecha de hoy en hora de Argentina (dd/mm/aaaa).
  const hoy = formatShiftDate(new Date().toISOString());
  return (
    <section
      aria-label="Lista para imprimir"
      data-testid="comercios-imprimir"
      className="hidden text-[10.5pt] leading-snug text-ink print:block"
    >
      <h1 className="text-[16pt] font-bold text-ink">Comercios a captar · {barrio}</h1>
      <p className="mt-1 text-[10pt] text-ink-soft">
        {filtro} · {plural(leads.length, "comercio", "comercios")} · impreso el {hoy}
      </p>

      <table className="mt-4 w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-ink text-[9pt] uppercase text-ink-soft">
            <th scope="col" className="w-6 py-1.5 pr-2">
              <span className="sr-only">Hecho</span>
            </th>
            <th scope="col" className="py-1.5 pr-2">Nombre</th>
            <th scope="col" className="py-1.5 pr-2">Dirección</th>
            <th scope="col" className="py-1.5 pr-2">Teléfono</th>
            <th scope="col" className="py-1.5 pr-2">Instagram</th>
            <th scope="col" className="py-1.5 pr-2">Estado</th>
            <th scope="col" className="w-[34%] py-1.5">Notas</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="break-inside-avoid border-b border-ink/30 align-top">
              <td className="py-2 pr-2">
                <span className="block size-4 border-[1.5px] border-ink" aria-hidden="true" />
              </td>
              <td className="py-2 pr-2">
                <span className="block font-semibold">{lead.name}</span>
                <span className="block text-[8.5pt] text-ink-soft">{LEAD_KIND_LABELS[lead.kind]}</span>
              </td>
              <td className="py-2 pr-2">{lead.address ?? ""}</td>
              <td className="whitespace-nowrap py-2 pr-2">{lead.phone ?? ""}</td>
              <td className="py-2 pr-2 break-all">{lead.instagram ?? ""}</td>
              <td className="py-2 pr-2">{LEAD_STATUS_LABELS[lead.status]}</td>
              <td className="h-14 py-2" />
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-[8.5pt] text-ink-soft">
        Datos de comercios © colaboradores de OpenStreetMap (ODbL)
      </p>
    </section>
  );
}
