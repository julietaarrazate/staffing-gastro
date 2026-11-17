/**
 * Encuesta para locales (`/encuesta`, ADR-0025): las opciones de cada
 * pregunta, los pasos, qué falta para avanzar y el cuerpo del pedido. Todo
 * puro, sin React: lo usa la pantalla pública (`components/encuesta/`) y el
 * panel de admin (`components/admin/EncuestaPanel.tsx`).
 */

export type Opcion<T extends string> = { valor: T; etiqueta: string };

export type LocalKind = "restaurante" | "bar" | "cafe" | "comida_rapida" | "heladeria" | "otro";
export type TeamModel = "equipo_fijo" | "por_turno" | "mixto";
export type EventualRange = "0" | "1-3" | "4-10" | "mas_de_10";
export type Role =
  | "mozo"
  | "runner"
  | "bacha"
  | "barra"
  | "barista"
  | "cocina"
  | "caja"
  | "recepcion"
  | "otro";
export type Channel = "whatsapp" | "conocidos" | "agencia" | "redes" | "otro";
export type AbsenceOutcome =
  | "lo_cubrio_el_equipo"
  | "doble_turno"
  | "cerre_una_parte"
  | "perdi_ventas"
  | "otro";
export type PricingPreference = "mensualidad" | "por_turno" | "no_se";

export const LOCAL_KINDS: Opcion<LocalKind>[] = [
  { valor: "restaurante", etiqueta: "Restaurante" },
  { valor: "bar", etiqueta: "Bar" },
  { valor: "cafe", etiqueta: "Café" },
  { valor: "comida_rapida", etiqueta: "Comida rápida" },
  { valor: "heladeria", etiqueta: "Heladería" },
  { valor: "otro", etiqueta: "Otro" },
];

export const TEAM_MODELS: Opcion<TeamModel>[] = [
  { valor: "equipo_fijo", etiqueta: "Un equipo fijo" },
  { valor: "por_turno", etiqueta: "Armo el equipo turno por turno" },
  { valor: "mixto", etiqueta: "Un poco de cada uno" },
];

export const EVENTUAL_RANGES: Opcion<EventualRange>[] = [
  { valor: "0", etiqueta: "Ninguna" },
  { valor: "1-3", etiqueta: "De 1 a 3" },
  { valor: "4-10", etiqueta: "De 4 a 10" },
  { valor: "mas_de_10", etiqueta: "Más de 10" },
];

export const ROLES: Opcion<Role>[] = [
  { valor: "mozo", etiqueta: "Mozo o moza" },
  { valor: "runner", etiqueta: "Runner" },
  { valor: "bacha", etiqueta: "Bacha" },
  { valor: "barra", etiqueta: "Barra" },
  { valor: "barista", etiqueta: "Barista" },
  { valor: "cocina", etiqueta: "Cocina" },
  { valor: "caja", etiqueta: "Caja" },
  { valor: "recepcion", etiqueta: "Recepción" },
  { valor: "otro", etiqueta: "Otro" },
];

export const CHANNELS: Opcion<Channel>[] = [
  { valor: "whatsapp", etiqueta: "Grupos de WhatsApp" },
  { valor: "conocidos", etiqueta: "Conocidos y referidos" },
  { valor: "agencia", etiqueta: "Una agencia" },
  { valor: "redes", etiqueta: "Redes sociales" },
  { valor: "otro", etiqueta: "Otra forma" },
];

export const ABSENCE_OUTCOMES: Opcion<AbsenceOutcome>[] = [
  { valor: "lo_cubrio_el_equipo", etiqueta: "Lo cubrió el equipo" },
  { valor: "doble_turno", etiqueta: "Alguien hizo doble turno" },
  { valor: "cerre_una_parte", etiqueta: "Cerré una parte del local" },
  { valor: "perdi_ventas", etiqueta: "Perdí ventas" },
  { valor: "otro", etiqueta: "Otra cosa" },
];

export const PRICING_PREFERENCES: Opcion<PricingPreference>[] = [
  { valor: "mensualidad", etiqueta: "Una mensualidad fija" },
  { valor: "por_turno", etiqueta: "Pagar por cada turno cubierto" },
  { valor: "no_se", etiqueta: "Todavía no sé" },
];

export function etiquetaDe<T extends string>(opciones: Opcion<T>[], valor: T): string {
  return opciones.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/** Pago por jornada de unas 8 h: el mismo rango que valida el backend. */
export const PAGO_MIN = 5_000;
export const PAGO_MAX = 1_000_000;

export interface Respuestas {
  localKind: LocalKind | null;
  barrio: string;
  teamModel: TeamModel | null;
  eventualsNormal: EventualRange | null;
  eventualsPeak: EventualRange | null;
  roles: Role[];
  channels: Channel[];
  absence: AbsenceOutcome[];
  /** Monto canónico de `PesosInput` («40000»), o «» si lo dejó vacío. */
  pago: string;
  pricing: PricingPreference | null;
  wantsBeta: boolean;
  contactName: string;
  businessName: string;
  phone: string;
  email: string;
  consent: boolean;
}

export const RESPUESTAS_VACIAS: Respuestas = {
  localKind: null,
  barrio: "",
  teamModel: null,
  eventualsNormal: null,
  eventualsPeak: null,
  roles: [],
  channels: [],
  absence: [],
  pago: "",
  pricing: null,
  wantsBeta: false,
  contactName: "",
  businessName: "",
  phone: "",
  email: "",
  consent: false,
};

export type PasoId =
  | "tipo"
  | "barrio"
  | "equipo"
  | "mes_normal"
  | "mes_fuerte"
  | "puestos"
  | "canales"
  | "ausencia"
  | "pago"
  | "precio"
  | "contacto";

/** Un paso por pantalla, en el orden en que se preguntan. */
export const PASOS: PasoId[] = [
  "tipo",
  "barrio",
  "equipo",
  "mes_normal",
  "mes_fuerte",
  "puestos",
  "canales",
  "ausencia",
  "pago",
  "precio",
  "contacto",
];

export const TITULOS: Record<PasoId, string> = {
  tipo: "¿Qué tipo de local tenés?",
  barrio: "¿En qué barrio está?",
  equipo: "¿Cómo armás tu equipo?",
  mes_normal: "En un mes normal, ¿cuántas personas eventuales sumás?",
  mes_fuerte: "¿Y en el mes de más trabajo?",
  puestos: "¿Para qué puestos buscás personal eventual?",
  canales: "¿Cómo lo conseguís hoy?",
  ausencia: "La última vez que alguien faltó, ¿qué pasó?",
  pago: "¿Cuánto pagás por una jornada de unas 8 horas?",
  precio: "Si Oído te cobrara, ¿cómo preferirías pagar?",
  contacto: "¿Querés sumarte a la beta?",
};

/** Ayuda corta bajo el título; los pasos de varias opciones lo avisan. */
export const AYUDAS: Partial<Record<PasoId, string>> = {
  barrio: "Es opcional.",
  puestos: "Podés marcar más de uno.",
  canales: "Podés marcar más de uno.",
  ausencia: "Podés marcar más de una.",
  pago: "En pesos, por persona. Es opcional.",
  contacto: "Es opcional. Si nos dejás cómo escribirte, te avisamos cuando abra.",
};

/** El pago como número, o null si está vacío. */
export function pagoComoNumero(pago: string): number | null {
  return /^\d+$/.test(pago) ? Number(pago) : null;
}

/** Qué le falta a la persona para pasar de este paso; «null» si puede seguir. */
export function faltaEnPaso(paso: PasoId, r: Respuestas): string | null {
  switch (paso) {
    case "tipo":
      return r.localKind ? null : "Elegí una opción para seguir.";
    case "equipo":
      return r.teamModel ? null : "Elegí una opción para seguir.";
    case "mes_normal":
      return r.eventualsNormal ? null : "Elegí una opción para seguir.";
    case "mes_fuerte":
      return r.eventualsPeak ? null : "Elegí una opción para seguir.";
    case "precio":
      return r.pricing ? null : "Elegí una opción para seguir.";
    case "pago": {
      const pago = pagoComoNumero(r.pago);
      if (r.pago !== "" && pago === null) return "Escribí un monto en pesos.";
      if (pago !== null && (pago < PAGO_MIN || pago > PAGO_MAX)) {
        return "Revisá el monto: tiene que estar entre $5.000 y $1.000.000.";
      }
      return null;
    }
    case "contacto":
      return faltaEnContacto(r);
    default:
      return null;
  }
}

export function tieneContacto(r: Respuestas): boolean {
  return [r.contactName, r.businessName, r.phone, r.email].some((v) => v.trim() !== "");
}

function faltaEnContacto(r: Respuestas): string | null {
  if (r.wantsBeta && r.phone.trim() === "" && r.email.trim() === "") {
    return "Para sumarte a la beta dejanos un teléfono o un email.";
  }
  if (r.phone.trim() !== "" && r.phone.replace(/\D/g, "").length < 8) {
    return "El teléfono parece incompleto.";
  }
  if (r.email.trim() !== "" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email.trim())) {
    return "El email no parece válido.";
  }
  if (tieneContacto(r) && !r.consent) {
    return "Marcá que aceptás que guardemos tus datos para poder enviar.";
  }
  return null;
}

/** El `?ref=` del link (qué grupo la trajo): corto y sin caracteres raros. */
export function limpiarRef(ref: string | null | undefined): string | null {
  const limpio = (ref ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .slice(0, 60);
  return limpio === "" ? null : limpio;
}

/** Cuerpo de `POST /encuesta`. Los campos vacíos no se mandan. */
export function armarPedido(r: Respuestas, source: string | null, honeypot = "") {
  const texto = (v: string) => (v.trim() === "" ? undefined : v.trim());
  return {
    local_kind: r.localKind,
    barrio: texto(r.barrio),
    team_model: r.teamModel,
    eventuals_normal_month: r.eventualsNormal,
    eventuals_peak_month: r.eventualsPeak,
    roles: r.roles,
    current_channels: r.channels,
    last_absence_outcome: r.absence,
    pay_per_shift_ars: pagoComoNumero(r.pago) ?? undefined,
    pricing_preference: r.pricing,
    wants_beta: r.wantsBeta,
    contact_name: texto(r.contactName),
    business_name: texto(r.businessName),
    phone: texto(r.phone),
    email: texto(r.email),
    consent: tieneContacto(r) && r.consent,
    source: source ?? undefined,
    company_website: honeypot === "" ? undefined : honeypot,
  };
}

// --- Admin -----------------------------------------------------------------

export interface EncuestaRespuesta {
  id: string;
  created_at: string;
  local_kind: LocalKind;
  barrio: string | null;
  team_model: TeamModel;
  eventuals_normal_month: EventualRange;
  eventuals_peak_month: EventualRange;
  roles: Role[];
  current_channels: Channel[];
  pay_per_shift_ars: number | null;
  last_absence_outcome: AbsenceOutcome[];
  pricing_preference: PricingPreference;
  wants_beta: boolean;
  contact_name: string | null;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  consent_at: string | null;
  source: string | null;
}

export interface EncuestaLista {
  items: EncuestaRespuesta[];
  total: number;
}

export interface EncuestaResumen {
  total: number;
  with_contact: number;
  team_model: Record<string, number>;
  eventuals_normal_month: Record<string, number>;
  roles: Record<string, number>;
  pricing_preference: Record<string, number>;
  pay_per_shift_median_ars: number | null;
  pay_per_shift_samples: number;
}

/** Distribución como filas {etiqueta, cantidad, parte (0 a 1 del máximo)}. */
export function filasDeDistribucion<T extends string>(
  conteo: Record<string, number>,
  opciones: Opcion<T>[]
): { etiqueta: string; cantidad: number; parte: number }[] {
  const max = Math.max(1, ...opciones.map((o) => conteo[o.valor] ?? 0));
  return opciones.map((o) => {
    const cantidad = conteo[o.valor] ?? 0;
    return { etiqueta: o.etiqueta, cantidad, parte: cantidad / max };
  });
}
