/**
 * Verificación de identidad (EPIC-001, ADR-0010). Tipos y etiquetas del dominio
 * Identity (Claim/Evidence) que expone el backend en `/identity/*`.
 *
 * Ojo — esto NO es reputación: "Identidad verificada" responde "¿es quien dice
 * ser?", no "¿trabaja bien?". Se muestra con tratamiento propio, separado de
 * las insignias de desempeño (`lib/reputation.tsx`).
 */

export type ClaimStatus =
  | "no_presentada"
  | "pendiente"
  | "verificada"
  | "rechazada"
  | "expirada";

export type AssuranceLevel = "L0" | "L1" | "L2" | "L3" | "L4";

export interface ClaimSummary {
  claim_type: string;
  status: ClaimStatus;
  confidence: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
}

export interface IdentitySummary {
  user_id: string;
  assurance_level: AssuranceLevel;
  identidad_verificada: boolean;
  claims: ClaimSummary[];
}

/**
 * Una evidencia de la cola del admin. Sin URL (ADR-0021): el archivo es
 * privado, y para verlo se pide un link que vence con `evidenceLinkPath`.
 */
export interface PendingEvidence {
  evidence_id: string;
  evidence_type: string;
  /** `false` si ya no hay archivo (purgado). */
  available: boolean;
}

/** Link para ver una evidencia. `expires_at` es `null` sólo en evidencias
 * viejas, todavía públicas, que no pasaron por la migración. */
export interface EvidenceLink {
  url: string;
  expires_at: string | null;
}

export function evidenceLinkPath(evidenceId: string): string {
  return `/identity/evidences/${encodeURIComponent(evidenceId)}/link`;
}

/** Margen antes del vencimiento para pedir un link nuevo en vez de abrir
 * uno que puede vencer mientras carga. */
const LINK_MARGIN_MS = 30_000;

/** ¿Hay que pedir un link nuevo antes de abrirlo? */
export function isLinkStale(link: EvidenceLink, now: number = Date.now()): boolean {
  if (!link.expires_at) return false;
  return new Date(link.expires_at).getTime() - LINK_MARGIN_MS <= now;
}

export interface PendingClaim {
  claim_id: string;
  user_id: string;
  claim_type: string;
  full_name: string | null;
  /** Sólo en claims de negocio (ADR-0013): el nombre que el comercio cargó en
   * la app, para comparar contra la razón social de la constancia. */
  company_name: string | null;
  submitted_at: string | null;
  evidences: PendingEvidence[];
}

/** Estado del claim de documento del propio usuario (para la tarjeta de perfil). */
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  no_presentada: "Sin verificar",
  pendiente: "En revisión",
  verificada: "Verificada",
  rechazada: "Rechazada",
  expirada: "Vencida",
};

export const EVIDENCE_LABELS: Record<string, string> = {
  dni_frente: "DNI (frente)",
  dni_dorso: "DNI (dorso)",
  selfie: "Selfie",
  liveness: "Prueba de vida",
  constancia_cuit: "Constancia de AFIP",
};

/** El claim que construye la F1: documento (DNI + selfie) revisado por un admin. */
export const DOCUMENT_CLAIM_TYPE = "documento_verificado";

/**
 * El claim del COMERCIO (ADR-0013): constancia de inscripción de AFIP.
 *
 * Ojo con el nombre — no es `cuit_verificado`, que queda reservado para la
 * validación automática contra AFIP. Acá una persona mira un PDF.
 */
export const BUSINESS_CLAIM_TYPE = "negocio_verificado";

/** Devuelve el claim de documento del resumen, si existe. */
export function documentClaim(summary: IdentitySummary): ClaimSummary | undefined {
  return summary.claims.find((c) => c.claim_type === DOCUMENT_CLAIM_TYPE);
}

/** Devuelve el claim de negocio del resumen, si existe. */
export function businessClaim(summary: IdentitySummary): ClaimSummary | undefined {
  return summary.claims.find((c) => c.claim_type === BUSINESS_CLAIM_TYPE);
}

/**
 * Una evidencia que NO es una imagen (hoy: la constancia de AFIP, que suele
 * ser PDF). Importa en la cola del admin: renderizar un PDF con `<img>` da una
 * imagen rota, no un documento.
 */
export function isDocumentEvidence(evidenceType: string): boolean {
  return evidenceType === "constancia_cuit";
}
