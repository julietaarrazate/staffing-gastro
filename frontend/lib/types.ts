export type UserRole = "worker" | "employer" | "admin";

export type WorkerSkill =
  | "mozo"
  | "bartender"
  | "barista"
  | "runner"
  | "cocinero"
  | "cajero"
  | "recepcionista"
  | "personal_eventos"
  | "ayudante_cocina"
  | "personal_salon";

export const WORKER_SKILLS: WorkerSkill[] = [
  "mozo",
  "bartender",
  "barista",
  "runner",
  "cocinero",
  "cajero",
  "recepcionista",
  "personal_eventos",
  "ayudante_cocina",
  "personal_salon",
];

export const SKILL_LABELS: Record<WorkerSkill, string> = {
  mozo: "Mozo/a",
  bartender: "Bartender",
  barista: "Barista",
  runner: "Runner",
  cocinero: "Cocinero/a",
  cajero: "Cajero/a",
  recepcionista: "Recepcionista",
  personal_eventos: "Personal de eventos",
  ayudante_cocina: "Ayudante de cocina",
  personal_salon: "Personal de salón",
};

export type ShiftStatus =
  | "borrador"
  | "publicado"
  | "buscando_personal"
  | "asignado"
  | "confirmado"
  | "en_camino"
  | "check_in"
  | "trabajando"
  | "check_out"
  | "finalizado"
  | "pagado"
  | "cancelado";

export const STATUS_LABELS: Record<ShiftStatus, string> = {
  borrador: "Borrador",
  publicado: "Publicado",
  buscando_personal: "Buscando personal",
  asignado: "Asignado",
  confirmado: "Confirmado",
  en_camino: "En camino",
  check_in: "Check-in",
  trabajando: "Trabajando",
  check_out: "Check-out",
  finalizado: "Finalizado",
  pagado: "Pagado",
  cancelado: "Cancelado",
};

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: string;
  is_verified: boolean;
}

export interface Shift {
  id: string;
  company_id: string;
  position: WorkerSkill;
  quantity: number;
  start_at: string;
  end_at: string;
  pay_amount: string;
  currency: string;
  tips: boolean;
  /** "Perso"/comida de personal incluida (beneficio del turno, como `tips`). */
  meal: boolean;
  dress_code: string | null;
  urgent: boolean;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  title: string | null;
  description: string | null;
  status: ShiftStatus;
  worker_profile_id: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_at: string | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_at: string | null;
  paid_at: string | null;
  // No-show (ADR-0007): registro auditable de cuándo/quién fue marcado
  // ausente antes de que el turno se reabra a `buscando_personal`.
  no_show_at: string | null;
  last_no_show_worker_profile_id: string | null;
  // Publicación masiva para un evento (catering, boda, etc.): turnos que
  // comparten `event_id` se publicaron juntos desde /shifts/new-event.
  event_id: string | null;
  event_name: string | null;
  created_at: string | null;
  company_name: string | null;
  company_logo_url: string | null;
}

/** Campos parciales de `POST /shifts/parse-text` (P2, auditoría de
 * producto 2026-08-10): PRECARGA el wizard de `/shifts/new`, cualquiera
 * puede venir `null` cuando la IA no pudo inferirlo — el comercio revisa y
 * confirma cada paso a mano, esto nunca publica un turno directo. */
export interface ParsedShiftDraft {
  position: WorkerSkill | null;
  start_at: string | null;
  end_at: string | null;
  pay_amount: string | null;
  urgent: boolean;
  meal: boolean;
  tips: boolean;
  dress_code: string | null;
}

/** Un rol dentro de un evento (`crear_evento`) — mismo par que una fila del
 * formulario de /shifts/new-event, sin `payAmount` propio: el asistente
 * comparte un único `pay_amount` para todos los roles del evento. */
export interface AssistantEventRole {
  position: WorkerSkill;
  quantity: number;
}

/** Respuesta de `POST /assistant/query` (asistente general del panel del
 * comercio, pedido de Julieta: "que entienda si es un evento, un turno, y
 * toda la app"). Un único intent viene con datos poblados; el resto queda
 * en `null` — el frontend rama por `intent` (ver `AIAssistantFab.tsx`). */
export interface AssistantQueryResponse {
  intent:
    | "crear_turno"
    | "crear_evento"
    | "consultar_turnos"
    | "buscar_candidatos"
    | "ver_postulantes"
    | "desconocido";
  message: string | null;
  // `crear_turno`
  position: WorkerSkill | null;
  start_at: string | null;
  end_at: string | null;
  pay_amount: string | null;
  urgent: boolean | null;
  meal: boolean | null;
  tips: boolean | null;
  dress_code: string | null;
  // `crear_evento` (comparte start_at/end_at/pay_amount/urgent/meal/tips/
  // dress_code de arriba)
  event_positions: AssistantEventRole[] | null;
  // `consultar_turnos`
  query_summary: string | null;
  query_count: number | null;
  query_tab: string | null;
  // `buscar_candidatos`
  search_position: WorkerSkill | null;
  // `ver_postulantes`
  matched_shift_id: string | null;
}

/** Resultado de `POST /shifts/events`: `requested` vs. `shifts.length` —
 *  si son distintos, el plan del comercio se quedó sin cupo a mitad de
 *  camino (publicación parcial). */
export interface EventResult {
  event_id: string;
  requested: number;
  shifts: Shift[];
}

// Vista pública de un turno (sin autenticación, GET /shifts/{id}/public):
// sólo los campos seguros para compartir — nada de contacto del comercio,
// postulantes, ni ids internos más allá del propio turno.
export interface ShiftPublic {
  id: string;
  position: WorkerSkill;
  start_at: string;
  end_at: string;
  city: string | null;
  pay_amount: string;
  currency: string;
  company_name: string | null;
}

export interface CandidateMatch {
  profile_id: string;
  user_id: string;
  full_name: string;
  photo_url: string | null;
  rating: number;
  score: number;
  distance_km: number | null;
  events_completed: number;
  punctuality_rate: number;
  years_experience: number;
  badges: string[];
  level: string;
  identidad_verificada: boolean;
}

export interface WorkerMapResult {
  profile_id: string;
  user_id: string;
  full_name: string;
  photo_url: string | null;
  rating: number;
  skills: WorkerSkill[];
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
}

export interface FavoriteWorker {
  worker_profile_id: string;
  full_name: string;
  photo_url: string | null;
  rating: number;
  skills: WorkerSkill[];
  is_available: boolean;
  events_completed: number;
  shifts_together: number;
  favorited_at: string | null;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  full_name?: string | null;
  photo_url: string | null;
  birth_date: string | null;
  age: number | null;
  city: string | null;
  bio: string | null;
  latitude: number | null;
  longitude: number | null;
  skills: WorkerSkill[];
  years_experience: number;
  languages: string[];
  certifications: string[];
  cv_url: string | null;
  cv_filename: string | null;
  is_available: boolean;
  rating: number;
  events_completed: number;
  punctuality_rate: number;
  cancellations: number;
  no_shows: number;
  badges: string[];
  level: string;
  identidad_verificada: boolean;
}

export type NotificationType =
  | "shift_assigned"
  | "shift_confirmed"
  | "shift_rejected"
  | "shift_checked_out"
  | "shift_paid"
  | "shift_reopened"
  | "chat_message"
  | "review_received"
  | "new_applicant"
  | "shift_no_show"
  | "shift_cancelled_late"
  | "new_shift_nearby"
  | "support_reply";

export type ApplicationStatus = "pendiente" | "aceptada" | "rechazada" | "retirada";

export interface ShiftApplication {
  id: string;
  shift_id: string;
  worker_profile_id: string;
  status: ApplicationStatus;
  created_at: string | null;
  // Turno embebido en GET /applications/mine para pintar la tarjeta sin un
  // GET /shifts/{id} por postulación (ver backend ApplicationResponse.shift).
  shift?: Shift | null;
}

export interface Applicant {
  application_id: string;
  worker_profile_id: string;
  full_name: string;
  photo_url: string | null;
  rating: number;
  is_available: boolean;
  status: ApplicationStatus;
  created_at: string | null;
  events_completed: number;
  punctuality_rate: number;
  years_experience: number;
  badges: string[];
  level: string;
}

export interface Review {
  id: string;
  shift_id: string;
  reviewer_user_id: string;
  reviewee_user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  shift_id: string;
  sender_user_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface Conversation {
  shift_id: string;
  shift_title: string;
  other_party_name: string;
  other_party_photo: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  /** Pantalla que abre el aviso al tocarlo. `null` en avisos viejos. */
  link: string | null;
  created_at: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: string;
  is_verified: boolean;
  created_at: string | null;
  photo_url: string | null;
}

export interface PlatformStats {
  total_users: number;
  workers: number;
  employers: number;
  admins: number;
  active: number;
  suspended: number;
  verified: number;
  // Promesa central del negocio ("cubrir un puesto en menos de 10
  // minutos", PRODUCT.md): null hasta que haya al menos un turno cubierto
  // después de que se empezó a medir (sin backfill de turnos viejos).
  coverage_sample_size: number;
  avg_time_to_fill_minutes: number | null;
  pct_filled_under_10_min: number | null;
}

// Fase 1 de ADR-0005 (mensualidad al comercio). Contrato de API congelado,
// construido en paralelo por el backend — no inventar campos ni endpoints.
export type SubscriptionStatus = "activa" | "vencida" | "cancelada" | string;

export interface Subscription {
  plan_code: string;
  status: SubscriptionStatus;
  period_end: string | null;
  price_ars: number | string;
  /** `null` = ilimitado. */
  max_turnos_mes: number | null;
  turnos_usados_mes: number;
}

export interface SubscriptionPlan {
  code: string;
  name: string;
  price_ars: number | string;
  /** `null` = ilimitado. */
  max_turnos_mes: number | null;
  features: string[];
}

export interface CompanyProfile {
  id: string;
  user_id: string;
  owner_full_name?: string | null;
  name: string;
  logo_url: string | null;
  category: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  opening_hours: string | null;
  rating: number;
  events_published: number;
  on_time_payment_rate: number;
  late_cancellations: number;
}

export type TicketCategory = "general" | "cv_documentos" | "pagos" | "cuenta" | "otro";
export type TicketStatus = "abierto" | "cerrado";

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  general: "General",
  cv_documentos: "CV / Documentos",
  pagos: "Pagos",
  cuenta: "Mi cuenta",
  otro: "Otro",
};

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_user_id: string;
  body: string;
  created_at: string | null;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  created_at: string | null;
  updated_at: string | null;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: SupportMessage[];
}

/** Sugerencia interna de IA para un ticket (sólo admin) — nunca se le manda
 * directo al usuario, sólo precarga el campo de respuesta para revisar. */
export interface TicketSuggestion {
  summary: string;
  suggested_reply: string;
}

export interface AdminSupportTicket {
  id: string;
  user_id: string;
  user_full_name: string;
  user_email: string;
  user_role: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  message_count: number;
  last_message_at: string | null;
  created_at: string | null;
}
