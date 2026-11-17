"use client";

// Encuesta para locales (ADR-0025), dentro de «Crecimiento»: el resumen de lo
// que contestaron y la lista de quienes dejaron cómo escribirles. Sólo lectura.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import {
  CHANNELS,
  EVENTUAL_RANGES,
  LOCAL_KINDS,
  PRICING_PREFERENCES,
  RESPONDENT_ROLES,
  ROLES,
  TEAM_MODELS,
  etiquetaDe,
  filasDeDistribucion,
  type EncuestaLista,
  type EncuestaResumen,
  type Opcion,
} from "@/lib/encuesta";
import { formatArs } from "@/lib/format";
import { SectionLabel, StatCard, StatCardSkeleton } from "@/components/admin/AdminStats";
import { Badge, Button, EmptyState, ErrorBanner } from "@/components/ui";
import { BuildingIcon } from "@/components/icons";

const PAGINA = 20;

export default function EncuestaPanel() {
  const { token } = useAuth();
  const [resumen, setResumen] = useState<EncuestaResumen | null>(null);
  const [lista, setLista] = useState<EncuestaLista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);

  const cargar = useCallback(() => {
    if (!token) return;
    setError(null);
    Promise.all([
      api.get<EncuestaResumen>("/admin/encuesta/summary", token),
      api.get<EncuestaLista>(`/admin/encuesta?with_contact=true&limit=${PAGINA}`, token),
    ])
      .then(([r, l]) => {
        setResumen(r);
        setLista(l);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudo cargar la encuesta")));
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  /** Borra el contacto de una respuesta: ya no es «con contacto», así que sale
   * de la lista y el resumen se vuelve a pedir. */
  const borrarContacto = async (id: string) => {
    if (!token || !lista) return;
    setBorrando(true);
    try {
      await api.post(`/admin/encuesta/${id}/borrar-contacto`, undefined, token);
      setLista({ items: lista.items.filter((r) => r.id !== id), total: Math.max(0, lista.total - 1) });
      setConfirmando(null);
      api
        .get<EncuestaResumen>("/admin/encuesta/summary", token)
        .then(setResumen)
        .catch(() => undefined);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo borrar el contacto"));
    } finally {
      setBorrando(false);
    }
  };

  const verMas = async () => {
    if (!token || !lista) return;
    setCargandoMas(true);
    try {
      const mas = await api.get<EncuestaLista>(
        `/admin/encuesta?with_contact=true&limit=${PAGINA}&offset=${lista.items.length}`,
        token
      );
      setLista({ items: [...lista.items, ...mas.items], total: mas.total });
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo cargar más"));
    } finally {
      setCargandoMas(false);
    }
  };

  if (error && !resumen) return <ErrorBanner message={error} onRetry={cargar} />;
  if (!resumen || !lista) {
    return (
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-8">
      <section aria-label="Resumen de la encuesta">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Respuestas en total" value={resumen.total} />
          <StatCard label="De dueños y encargados" value={resumen.deciders} />
          <StatCard label="Con contacto para la beta" value={resumen.with_contact} />
          <StatCard
            label={
              resumen.pay_per_shift_samples > 0
                ? `Mediana del pago por jornada (${resumen.pay_per_shift_samples} ${resumen.pay_per_shift_samples === 1 ? "respuesta" : "respuestas"})`
                : "Mediana del pago por jornada"
            }
            value={
              resumen.pay_per_shift_median_ars === null
                ? "Sin datos"
                : formatArs(resumen.pay_per_shift_median_ars)
            }
          />
        </div>

        <p className="mt-6 text-sm text-ink/60">
          Las distribuciones y la mediana del pago cuentan sólo las {resumen.deciders} respuestas de
          dueños y encargados, que son quienes deciden.
        </p>
        <div className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2">
          <Distribucion titulo="Cómo arman el equipo" conteo={resumen.team_model} opciones={TEAM_MODELS} />
          <Distribucion
            titulo="Eventuales en un mes normal"
            conteo={resumen.eventuals_normal_month}
            opciones={EVENTUAL_RANGES}
          />
          <Distribucion titulo="Puestos que buscan" conteo={resumen.roles} opciones={ROLES} />
          <Distribucion
            titulo="Cómo preferirían pagar"
            conteo={resumen.pricing_preference}
            opciones={PRICING_PREFERENCES}
          />
        </div>
      </section>

      <section aria-label="Locales con contacto">
        <SectionLabel>Locales que dejaron contacto · {lista.total}</SectionLabel>
        {lista.items.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<BuildingIcon size={28} />}
              title="Todavía nadie dejó su contacto"
              subtitle="Cuando alguien lo deje en la encuesta, aparece acá."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] bg-card ring-1 ring-line">
            {lista.items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{r.business_name}</p>
                  <p className="mt-0.5 text-sm text-ink/60">
                    {[
                      r.contact_name,
                      etiquetaDe(RESPONDENT_ROLES, r.respondent_role),
                      etiquetaDe(LOCAL_KINDS, r.local_kind),
                      r.barrio,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {r.phone && (
                      <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-ink underline">
                        {r.phone}
                      </a>
                    )}
                    {r.email && (
                      <a href={`mailto:${encodeURIComponent(r.email)}`} className="font-medium text-ink underline">
                        {r.email}
                      </a>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-ink/50">
                    {[
                      `Eventuales: ${etiquetaDe(EVENTUAL_RANGES, r.eventuals_normal_month).toLowerCase()}`,
                      r.roles.length > 0
                        ? r.roles.map((x) => etiquetaDe(ROLES, x).toLowerCase()).join(", ")
                        : null,
                      r.current_channels.length > 0
                        ? `Hoy: ${r.current_channels.map((x) => etiquetaDe(CHANNELS, x).toLowerCase()).join(", ")}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-ink/50">
                  {r.wants_beta && <Badge tone="secondary">Quiere la beta</Badge>}
                  <span>{new Date(r.created_at).toLocaleDateString("es-AR")}</span>
                  {r.source && <span className="font-mono">ref: {r.source}</span>}
                </div>
                <div className="w-full pt-2">
                  {confirmando === r.id ? (
                    <div
                      role="group"
                      aria-label={`Confirmar el borrado del contacto de ${r.business_name}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-card)] bg-surface p-3 text-sm text-ink"
                    >
                      <span className="font-medium">
                        ¿Borrar el contacto de {r.business_name}? Queda la respuesta como estadística.
                      </span>
                      <span className="flex gap-2">
                        <Button size="sm" variant="surface" onClick={() => setConfirmando(null)} disabled={borrando}>
                          Cancelar
                        </Button>
                        <Button size="sm" variant="dark" onClick={() => borrarContacto(r.id)} loading={borrando}>
                          Borrar contacto
                        </Button>
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmando(r.id)}
                      aria-label={`Borrar contacto de ${r.business_name}`}
                      className="text-sm font-semibold text-danger-text underline underline-offset-2"
                    >
                      Borrar contacto
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {lista.items.length < lista.total && (
          <div className="mt-3">
            <Button size="sm" variant="surface" onClick={verMas} loading={cargandoMas}>
              Ver más
            </Button>
          </div>
        )}
        {error && <ErrorBanner message={error} />}
      </section>
    </div>
  );
}

/** Una distribución simple: una fila por opción, con su barra. */
function Distribucion<T extends string>({
  titulo,
  conteo,
  opciones,
}: {
  titulo: string;
  conteo: Record<string, number>;
  opciones: Opcion<T>[];
}) {
  const filas = filasDeDistribucion(conteo, opciones);
  return (
    <div>
      <SectionLabel>{titulo}</SectionLabel>
      <ul className="mt-2 space-y-1.5">
        {filas.map((f) => (
          <li key={f.etiqueta} className="grid grid-cols-[minmax(0,11rem)_1fr_2rem] items-center gap-2 text-sm">
            <span className="text-ink/75">{f.etiqueta}</span>
            <span className="h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
              <span
                className="block h-full rounded-full bg-primary-text"
                style={{ width: `${Math.round(f.parte * 100)}%` }}
              />
            </span>
            <span className="text-right font-semibold tabular-nums text-ink">{f.cantidad}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
