"use client";

// Comercios a captar para la beta (pedido de Julieta, 2026-10-20; ADR-0019).
// La lista sale de OpenStreetMap por barrio, no de scrapear Google Maps; cada
// comercio lleva su estado y notas de seguimiento. Sólo admin.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { AdminHeading } from "@/components/admin/AdminStats";
import type { Lead, LeadImportResult, LeadStatus, LeadSummary } from "@/lib/types";
import {
  LEAD_KIND_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  instagramHref,
  leadsToCsv,
  mapsHref,
  osmHref,
  priorityLabel,
  websiteHref,
} from "@/lib/leads";
import {
  Badge,
  Button,
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  useToast,
} from "@/components/ui";
import {
  BuildingIcon,
  DownloadIcon,
  MapPinIcon,
} from "@/components/icons";

type Filter = LeadStatus | "todos";

const SELECT_CLASS =
  "rounded-full bg-surface px-3 py-2 text-sm font-medium text-ink/75 ring-1 ring-line transition focus:bg-card focus:ring-2 focus:ring-primary/40";

export default function AdminLeadsPage() {
  // El control de acceso lo hace `app/admin/layout.tsx`.
  const { user, token } = useAuth();
  const toast = useToast();

  const [barrios, setBarrios] = useState<string[]>([]);
  const [barrio, setBarrio] = useState("Palermo");
  const [filter, setFilter] = useState<Filter>("todos");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const load = useCallback(() => {
    if (!token || !isAdmin) return;
    setListLoading(true);
    const query = new URLSearchParams({ barrio });
    if (filter !== "todos") query.set("status", filter);
    Promise.all([
      api.get<Lead[]>(`/admin/leads?${query}`, token),
      api.get<LeadSummary>(`/admin/leads/summary?barrio=${encodeURIComponent(barrio)}`, token),
    ])
      .then(([list, counts]) => {
        setLeads(list);
        setSummary(counts);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudo cargar la lista")))
      .finally(() => setListLoading(false));
  }, [token, isAdmin, barrio, filter]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    api
      .get<string[]>("/admin/leads/barrios", token)
      .then(setBarrios)
      .catch(() => setBarrios(["Palermo"]));
  }, [token, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const importBarrio = async () => {
    if (!token) return;
    setImporting(true);
    try {
      // Overpass puede tardar con barrios grandes: más margen que el default.
      const result = await api.post<LeadImportResult>(
        "/admin/leads/import",
        { barrio },
        token,
        100_000
      );
      toast(
        result.found === 0
          ? `OpenStreetMap no devolvió comercios para ${result.barrio}`
          : `${result.found} comercios: ${result.created} nuevos, ${result.updated} actualizados`,
        result.found === 0 ? "info" : "success"
      );
      load();
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo importar el barrio"), "error");
    } finally {
      setImporting(false);
    }
  };

  const patchLead = async (lead: Lead, body: { status?: LeadStatus; notes?: string }) => {
    if (!token) return;
    try {
      const updated = await api.patch<Lead>(`/admin/leads/${lead.id}`, body, token);
      setLeads((current) =>
        filter !== "todos" && updated.status !== filter
          ? current.filter((l) => l.id !== updated.id)
          : current.map((l) => (l.id === updated.id ? updated : l))
      );
      if (body.status) {
        api
          .get<LeadSummary>(`/admin/leads/summary?barrio=${encodeURIComponent(barrio)}`, token)
          .then(setSummary)
          .catch(() => undefined);
      }
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo guardar"), "error");
    }
  };

  const exportCsv = () => {
    const blob = new Blob([leadsToCsv(leads)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comercios-${barrio.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <AdminHeading
        title="Comercios a captar"
        subtitle="Bares, restaurantes y cafés del barrio, para salir a sumarlos a la beta."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Barrio"
          value={barrio}
          onChange={(e) => setBarrio(e.target.value)}
          className={SELECT_CLASS}
        >
          {(barrios.length > 0 ? barrios : ["Palermo"]).map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={importBarrio} disabled={importing}>
          <MapPinIcon size={16} />
          {importing ? "Buscando comercios…" : "Traer comercios del barrio"}
        </Button>
        <Button
          size="sm"
          variant="surface"
          onClick={exportCsv}
          disabled={leads.length === 0}
        >
          <DownloadIcon size={16} /> CSV
        </Button>
      </div>

      {summary && summary.total > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          <FilterChip
            active={filter === "todos"}
            onClick={() => setFilter("todos")}
            label={`Todos · ${summary.total}`}
          />
          {LEAD_STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={filter === s}
              onClick={() => setFilter(s)}
              label={`${LEAD_STATUS_LABELS[s]} · ${summary.counts[s] ?? 0}`}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-5">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}
      {listLoading && (
        <div className="mt-5">
          <CardSkeletons />
        </div>
      )}

      {!listLoading && !error && leads.length === 0 && (
        <div className="mt-5">
          <EmptyState
            icon={<BuildingIcon size={28} />}
            title={filter === "todos" ? `Todavía no hay comercios de ${barrio}` : "Ninguno en este estado"}
            subtitle={
              filter === "todos"
                ? "Tocá \"Traer comercios del barrio\" para armar la lista desde OpenStreetMap."
                : "Probá con otro estado o con \"Todos\"."
            }
          />
        </div>
      )}

      {!listLoading && !error && leads.length > 0 && (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onPatch={patchLead} />
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs text-ink/40">
        Datos de comercios ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          colaboradores de OpenStreetMap
        </a>{" "}
        (ODbL). Usalos para contactar comercios, no para enviar publicidad masiva.
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? // Mismo activo que `SegmentedControl` (bg-raised + text-ink), con un
            // anillo de tinta: `bg-night` se perdía sobre el lienzo oscuro.
            "rounded-full bg-raised px-3 py-1.5 text-xs font-semibold text-ink shadow-[var(--shadow-soft)] ring-1 ring-ink/50"
          : "rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink/60 ring-1 ring-line transition hover:bg-line"
      }
    >
      {label}
    </button>
  );
}

function LeadCard({
  lead,
  onPatch,
}: {
  lead: Lead;
  onPatch: (lead: Lead, body: { status?: LeadStatus; notes?: string }) => Promise<void>;
}) {
  const [notes, setNotes] = useState(lead.notes);
  const web = websiteHref(lead.website);
  const instagram = instagramHref(lead.instagram);
  const priority = priorityLabel(lead.priority);

  useEffect(() => setNotes(lead.notes), [lead.notes]);

  return (
    <li className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)] ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{lead.name}</p>
          <p className="mt-0.5 text-sm text-ink/50">
            {LEAD_KIND_LABELS[lead.kind]}
            {lead.address ? ` · ${lead.address}` : ""}
          </p>
        </div>
        <Badge tone={priority === "Alta" ? "secondary" : "neutral"}>Prioridad {priority.toLowerCase()}</Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {lead.phone && (
          <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-ink underline">
            {lead.phone}
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="font-medium text-ink underline">
            Email
          </a>
        )}
        {web && (
          <a href={web} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline">
            Web
          </a>
        )}
        {instagram && (
          <a href={instagram} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline">
            Instagram
          </a>
        )}
        <a href={mapsHref(lead)} target="_blank" rel="noopener noreferrer" className="font-medium text-ink/60 underline">
          Ver en Maps
        </a>
        <a href={osmHref(lead.osm_ref)} target="_blank" rel="noopener noreferrer" className="font-medium text-ink/60 underline">
          OSM
        </a>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <select
          aria-label={`Estado de ${lead.name}`}
          value={lead.status}
          onChange={(e) => onPatch(lead, { status: e.target.value as LeadStatus })}
          className={SELECT_CLASS}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        aria-label={`Notas de ${lead.name}`}
        value={notes}
        maxLength={2000}
        rows={2}
        placeholder="Notas: con quién hablaste, cuándo volver…"
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes !== lead.notes) onPatch(lead, { notes });
        }}
        className="mt-2 w-full resize-y rounded-[var(--radius-input)] bg-surface px-3 py-2 text-sm text-ink ring-1 ring-line placeholder:text-ink/40 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </li>
  );
}
