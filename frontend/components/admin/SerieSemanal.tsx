"use client";

// «Semana por semana» de "Métricas" (M7, docs/planning/BETA_TABLERO.md): la
// serie para el reporte de los lunes y la lámina de tracción. Semanas de
// lunes a domingo en hora argentina, cada turno en la semana en que se
// publicó, con las mismas definiciones que el período de arriba; y las altas
// de cada semana por origen y rol. El CSV lleva todo, de la semana más vieja
// a la más nueva, para armar el gráfico en una planilla.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { downloadCsv } from "@/lib/csv";
import {
  altasDelOrigen,
  inicioSemana,
  inicioSemanaIso,
  origenesDeLaSerie,
  serieACsv,
} from "@/lib/metricas-semanales";
import type { WeekSummary, WeeklyMetrics } from "@/lib/types";
import { Badge, Button, ErrorBanner, SegmentedControl, Skeleton } from "@/components/ui";
import { DownloadIcon } from "@/components/icons";
import { SectionLabel } from "@/components/admin/AdminStats";
import { etiquetaOrigen } from "@/components/admin/AltasPorOrigen";

type Semanas = "8" | "12" | "26";

const pct = (p: number | null) => (p === null ? "—" : `${p.toFixed(0)}%`);
const minutos = (m: number | null) => (m === null ? "—" : `${m.toFixed(0)} min`);

const TH = "px-2 pb-2 pt-4 text-right align-bottom font-medium";
const TD = "px-2 py-2 text-right tabular-nums text-ink-soft whitespace-nowrap";

/** Un conteo con su porcentaje debajo, más chico. */
function ConPct({ n, p }: { n: number; p: number | null }) {
  return (
    <>
      <span className="font-semibold text-ink">{n}</span>
      <span className="block text-xs text-ink-soft">{pct(p)}</span>
    </>
  );
}

function TablaSemanas({ semanas }: { semanas: WeekSummary[] }) {
  return (
    <div className="tarjeta-suave mt-2 overflow-x-auto p-0">
      <table className="w-full text-sm">
        <caption className="sr-only">Indicadores de cada semana, la más nueva primero</caption>
        <thead>
          <tr className="text-left text-xs font-medium text-ink-soft">
            <th scope="col" className="px-4 pb-2 pt-4 align-bottom font-medium sm:px-5">Semana</th>
            <th scope="col" className={TH}>Publicados</th>
            <th scope="col" className={TH}>Cubiertos</th>
            <th scope="col" className={TH}>Cumplidos</th>
            <th scope="col" className={TH}>Mediana hasta confirmar</th>
            <th scope="col" className={TH}>Locales activos</th>
            <th scope="col" className={TH}>Altas trabajadores</th>
            <th scope="col" className={`${TH} pr-4 sm:pr-5`}>Altas comercios</th>
          </tr>
        </thead>
        <tbody>
          {semanas.map((s) => (
            <tr key={s.start} className="border-t border-line align-top">
              <th
                scope="row"
                className="whitespace-nowrap px-4 py-2 text-left font-medium text-ink sm:px-5"
              >
                {inicioSemana(s)}
                {s.in_progress && (
                  <Badge tone="neutral" dense className="ml-2">
                    en curso
                  </Badge>
                )}
              </th>
              <td className={TD}>
                <span className="font-semibold text-ink">{s.shifts_published}</span>
              </td>
              <td className={TD}>
                <ConPct n={s.shifts_covered} p={s.covered_pct} />
              </td>
              <td className={TD}>
                <ConPct n={s.fulfilled} p={s.fulfilled_pct} />
              </td>
              <td className={TD}>{minutos(s.median_minutes_to_cover)}</td>
              <td className={TD}>{s.active_companies}</td>
              <td className={TD}>{s.signups_workers}</td>
              <td className={`${TD} pr-4 sm:pr-5`}>{s.signups_companies}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaOrigenes({ semanas }: { semanas: WeekSummary[] }) {
  const origenes = origenesDeLaSerie(semanas);
  if (origenes.length === 0) {
    return (
      <div className="tarjeta-suave mt-2 p-5">
        <p className="text-sm text-ink-soft">Ninguna cuenta nueva en estas semanas.</p>
      </div>
    );
  }
  return (
    <div className="tarjeta-suave mt-2 overflow-x-auto p-0">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Cuentas nuevas de cada semana por origen: trabajadores y comercios
        </caption>
        <thead>
          <tr className="text-left text-xs font-medium text-ink-soft">
            <th scope="col" className="px-4 pb-2 pt-4 align-bottom font-medium sm:px-5">Origen</th>
            {semanas.map((s, i) => (
              <th
                key={s.start}
                scope="col"
                className={`${TH} ${i === semanas.length - 1 ? "pr-4 sm:pr-5" : ""}`}
              >
                {inicioSemana(s)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {origenes.map((origen) => (
            <tr key={origen ?? "__sin_dato__"} className="border-t border-line">
              <th
                scope="row"
                className={`max-w-[10rem] break-words px-4 py-2 text-left font-medium sm:max-w-none sm:px-5 ${
                  origen === null ? "text-ink-soft" : "text-ink"
                }`}
              >
                {etiquetaOrigen(origen)}
              </th>
              {semanas.map((s, i) => {
                const altas = altasDelOrigen(s, origen);
                const nada = altas.workers === 0 && altas.companies === 0;
                return (
                  <td
                    key={s.start}
                    className={`${TD} ${i === semanas.length - 1 ? "pr-4 sm:pr-5" : ""} ${
                      nada ? "text-ink-soft" : ""
                    }`}
                  >
                    {nada ? "—" : `${altas.workers} · ${altas.companies}`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SerieSemanal({ token }: { token: string | null }) {
  const [cuantas, setCuantas] = useState<Semanas>("12");
  const [data, setData] = useState<WeeklyMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sólo vale la respuesta del último pedido: si se cambia rápido de 8 a 26
  // semanas y las respuestas llegan desordenadas, la vieja no pisa a la nueva.
  const ultimoPedido = useRef(0);
  const load = useCallback(() => {
    if (!token) return;
    const pedido = ++ultimoPedido.current;
    setData(null);
    setError(null);
    api
      .get<WeeklyMetrics>(`/admin/weekly-metrics?weeks=${cuantas}`, token)
      .then((d) => pedido === ultimoPedido.current && setData(d))
      .catch(
        (err) =>
          pedido === ultimoPedido.current &&
          setError(getErrorMessage(err, "No se pudo cargar la serie semanal"))
      );
  }, [token, cuantas]);

  useEffect(() => {
    load();
  }, [load]);

  // La API las da de la más vieja a la más nueva (como el CSV); en pantalla
  // va primero la de hoy.
  const recientes = data ? [...data.weeks].reverse() : null;

  const exportar = () => {
    if (!data || data.weeks.length === 0) return;
    const desde = inicioSemanaIso(data.weeks[0]);
    downloadCsv(serieACsv(data.weeks), `oido-semanas-desde-${desde}.csv`);
  };

  return (
    <div className="mt-8" data-testid="serie-semanal">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionLabel>Semana por semana</SectionLabel>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SegmentedControl<Semanas>
            className="min-w-0 flex-1 sm:flex-none"
            value={cuantas}
            onChange={setCuantas}
            options={[
              { value: "8", label: "8 semanas" },
              { value: "12", label: "12 semanas" },
              { value: "26", label: "26 semanas" },
            ]}
          />
          <Button size="sm" variant="surface" onClick={exportar} disabled={!data}>
            <DownloadIcon size={16} /> CSV
          </Button>
        </div>
      </div>
      {error && (
        <div className="mt-2">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}
      {!recientes ? (
        !error && <Skeleton className="mt-2 h-64 w-full" />
      ) : (
        <>
          <TablaSemanas semanas={recientes} />
          <p className="mt-1.5 px-1 text-xs text-ink-soft">
            Semanas de lunes a domingo, hora argentina. Cada turno cuenta en la semana en que se
            publicó. Cubierto: la persona confirmó; cumplido: llegó al local. El CSV va de la semana
            más vieja a la más nueva, con las altas de cada origen.
          </p>
          <div className="mt-6">
            <SectionLabel>Altas por origen, semana por semana</SectionLabel>
          </div>
          <TablaOrigenes semanas={recientes} />
          <p className="mt-1.5 px-1 text-xs text-ink-soft">
            Cada celda: trabajadores · comercios.
          </p>
        </>
      )}
    </div>
  );
}
