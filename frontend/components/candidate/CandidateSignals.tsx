import type { ComponentType } from "react";
import { Rating } from "@/components/ui";
import {
  AwardIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  StarIcon,
  type IconProps,
} from "@/components/icons";
import { formatPunctuality } from "@/lib/reputation";

/**
 * Señales legibles de un candidato/postulante, para que el comercio vea *por
 * qué* conviene alguien en vez de un score opaco (inspiración: la pantalla de
 * presupuestos de Clickie, "¿Por qué lo elige?"). Todos los datos ya vienen
 * del backend sin consulta extra (matching y JOIN de postulantes).
 */
export interface CandidateSignals {
  rating: number;
  events_completed: number;
  punctuality_rate: number;
  years_experience: number;
  distance_km?: number | null;
}

interface Reason {
  Icon: ComponentType<IconProps>;
  label: string;
}

/**
 * Motivos positivos y VERDADEROS por los que recomendar a alguien, en orden de
 * peso (cercanía → puntualidad → experiencia → calificación → oficio). Sólo se
 * emiten cuando el dato los respalda, para no inflar a quien recién empieza.
 * Se muestran hasta 3 en la tarjeta del recomendado.
 */
export function topReasons(s: CandidateSignals, max = 3): Reason[] {
  const reasons: Reason[] = [];
  if (s.distance_km != null && s.distance_km <= 3) {
    reasons.push({ Icon: MapPinIcon, label: `A ${s.distance_km.toFixed(1)} km del local` });
  }
  if (s.events_completed >= 3 && s.punctuality_rate >= 0.9) {
    reasons.push({ Icon: ClockIcon, label: `Muy puntual (${formatPunctuality(s.punctuality_rate)})` });
  }
  if (s.events_completed >= 10) {
    reasons.push({ Icon: CheckCircleIcon, label: `${s.events_completed} turnos en Staffya` });
  }
  if (s.rating >= 4.5 && s.events_completed >= 1) {
    reasons.push({ Icon: StarIcon, label: "Muy bien calificado" });
  }
  if (s.years_experience >= 3) {
    reasons.push({ Icon: AwardIcon, label: `${s.years_experience} años de oficio` });
  }
  return reasons.slice(0, max);
}

/** Chips factuales de confianza (neutros, un solo acento por pantalla). Sólo
 * los que tienen dato: no ensucia con "0 turnos" a quien recién arranca. */
export function CandidateStatChips({
  signals,
  className,
}: {
  signals: CandidateSignals;
  className?: string;
}) {
  const hasHistory = signals.events_completed > 0;
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className ?? ""}`}>
      <Rating value={signals.rating} />
      {signals.distance_km != null && (
        <StatChip>{signals.distance_km.toFixed(1)} km</StatChip>
      )}
      {hasHistory && <StatChip>{signals.events_completed} turnos</StatChip>}
      {hasHistory && signals.punctuality_rate > 0 && (
        <StatChip>{formatPunctuality(signals.punctuality_rate)} puntual</StatChip>
      )}
      {signals.years_experience > 0 && (
        <StatChip>{signals.years_experience} {signals.years_experience === 1 ? "año" : "años"} exp.</StatChip>
      )}
    </div>
  );
}

function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink/60">
      {children}
    </span>
  );
}

/** "Por qué te lo recomendamos": los motivos con el acento de marca. */
export function RecommendationReasons({ signals }: { signals: CandidateSignals }) {
  const reasons = topReasons(signals);
  if (reasons.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5">
      {reasons.map(({ Icon, label }) => (
        <p key={label} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/75">
          <Icon size={15} className="shrink-0 text-primary" />
          {label}
        </p>
      ))}
    </div>
  );
}
