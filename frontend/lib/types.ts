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
  | "cancelado"
  // ADR-0015: el SISTEMA resuelve solo un turno cuyo período de gracia
  // después de `start_at` se agotó sin llegar a `confirmado` — nunca una
  // persona. Terminal, distinto de `cancelado` a propósito: no hay nadie a
  // quien reclamarle, y la etiqueta no debe sugerir que sí lo hay.
  | "no_cubierto";

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
  no_cubierto: "No cubierto",
};

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: string;
  is_verified: boolean;
  /** Sólo en `/auth/me`: admin sin la verificación en dos pasos activada
   * (ADR-0023). Con eso la sesión sólo puede ir al alta. */
  two_factor_setup_required?: boolean;
  /** Sólo en `/auth/me`: los términos cambiaron desde lo último que aceptó;
   * la app le pide aceptar la versión vigente (`components/TerminosNuevos`). */
  terms_acceptance_required?: boolean;
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
  // "Va en camino": última posición del trabajador viajando al turno. `null`
  // salvo mientras efectivamente va en camino — el backend la borra al llegar
  // y en toda transición que lo desasigne. No es un historial: cada reporte
  // pisa al anterior.
  en_route_latitude: number | null;
  en_route_longitude: number | null;
  en_route_at: string | null;
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
  // Turno reofrecido (U080): se reabrió con el horario ya empezado y se
  // ofrece como urgente hasta `end_at`. Mientras nadie marcó la llegada, el
  // backend manda el valor por hora (`hourly_pay_amount`); al marcarla queda
  // fijo `prorated_pay_amount` (sólo lo reciben el comercio dueño y la
  // persona asignada). Qué mostrar lo decide `payView` (`lib/pay.ts`).
  reoffered_at?: string | null;
  hourly_pay_amount?: string | null;
  prorated_pay_amount?: string | null;
  /** Cuándo confirmó quien tiene el turno ahora (sólo para las partes). */
  confirmed_at?: string | null;
  /** Puntualidad real (sólo para las partes): la llegada la marcó el comercio
   *  («Ya llegó») y qué dijo, a horario (`true`) o tarde (`false`). */
  arrival_marked_by_company_at?: string | null;
  arrival_on_time?: boolean | null;
  /** El comercio lo puede corregir: mientras nadie esté asignado. */
  is_editable?: boolean;
  /** Reconfirmación antes del turno (ADR-0031, P3; sólo para las partes).
   *  A la persona: tiene una pregunta «¿Seguís disponible?» sin contestar. */
  reconfirmation_pending?: boolean | null;
  /** Cuándo contestó «Sí, sigo disponible». */
  reconfirmed_at?: string | null;
  /** Cuándo se le avisó al comercio que la persona no contestó. */
  no_reconfirm_alert_sent_at?: string | null;
  /** Cancelar ahora es avisar con tiempo: no suma una cancelación. `null` si
   *  la reconfirmación está apagada o el turno no está confirmado. */
  cancel_with_notice?: boolean | null;
  company_name: string | null;
  company_logo_url: string | null;
  /** Foto del local (fachada/salón). Opcional: mocks y respuestas viejas no la traen. */
  company_cover_url?: string | null;
  /** Sólo llega en `/shifts/me` (el panel del propio comercio): el backend no
   *  lo manda en el feed ni en `/shifts/mine`, que los leen trabajadores. */
  worker_name?: string | null;
  /** Postulaciones PENDIENTES del turno. Como `worker_name`: sólo llega en
   *  `/shifts/me` (el comercio dueño); el feed, el turno público y las rutas
   *  del trabajador no la mandan. Sin dato (`null`/ausente) no se muestra. */
  pending_applicants_count?: number | null;
  /** Pago de referencia (ADR-0012): dónde cae el pago por hora de este turno
   *  respecto de lo típico para ese puesto en esa ciudad. `null` cuando no
   *  hay con qué comparar (muestra insuficiente, sin ciudad) — ahí no se
   *  muestra nada, nunca se inventa una referencia. */
  pay_band?: "por_encima" | "tipico" | "por_debajo" | null;
  // ADR-0011: claim `negocio_verificado` del dueño del comercio. Sin flujo
  // de envío/revisión de evidencias de negocio todavía, así que hoy es
  // `false` para todos — el campo ya está listo para cuando exista.
  company_verified: boolean;
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
  /** Qué campos obligatorios no alcanzó a definir el texto, ya en palabras
   *  ("a qué hora termina"). Lo calcula el backend en código, no la IA. */
  missing?: string[];
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
 * en `null` — el frontend rama por `intent` (ver `AIAssistantBar.tsx`). */
export interface AssistantQueryResponse {
  intent:
    | "crear_turno"
    | "crear_evento"
    | "consultar_turnos"
    | "buscar_candidatos"
    | "ver_postulantes"
    | "consultar_verificacion"
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
  // `consultar_verificacion`
  verification_full_name: string | null;
  verification_verified: boolean | null;
}

/** Respuesta de `POST /assistant/worker-query` (asistente del trabajador,
 * pedido de Julieta: "búscame un turno en palermo a menos de 2 kilómetros
 * para hoy tanto para mozo barista y cajero"). A diferencia del asistente
 * del comercio, esto son SIEMPRE filtros estructurados, nunca resultados ya
 * resueltos — el frontend arma la búsqueda con esto (zona -> lat/lng con la
 * tabla de barrios de `lib/locations.ts`, radio, fecha) y la ejecuta contra
 * `GET /shifts/feed`, que ya sabe rankear/filtrar por distancia. */
export interface WorkerAssistantQueryResponse {
  intent: "buscar_turnos" | "desconocido";
  message: string | null;
  positions: WorkerSkill[] | null;
  zone_name: string | null;
  radius_km: number | null;
  date_filter: "hoy" | "todos" | null;
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
  /** Turno reofrecido (U080): ver `Shift`. */
  reoffered_at?: string | null;
  hourly_pay_amount?: string | null;
  company_name: string | null;
  // Condiciones del turno (van también sin sesión desde 2026-09-22). La
  // dirección exacta, la descripción y el logo siguen fuera.
  tips: boolean;
  meal: boolean;
  dress_code: string | null;
  urgent: boolean;
  /** Foto del local (sí va sin sesión, 2026-09-23; el logo no). */
  company_cover_url?: string | null;
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
  // ADR-0014: si esta posición es "Disponible ahora" (vigente) en vez de la
  // del perfil, y desde cuándo — arma "actualizado hace X min" vs. "zona del
  // perfil".
  is_live: boolean;
  position_updated_at: string | null;
}

/** Estado de "Disponible ahora" (ADR-0014) del trabajador autenticado. */
export interface AvailableNowStatus {
  active: boolean;
  until: string | null;
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

/** Referencia al CV subido (privado): lo que devuelve Cloudinary al subirlo.
 * No es una URL; para verlo se pide un link que vence (`lib/cv.ts`). */
export interface CvFileRef {
  public_id: string;
  resource_type: string;
  format: string;
  type: "authenticated";
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
  /** Link pegado a mano (Drive, LinkedIn) o un CV viejo todavía público.
   * Sólo lo recibe el dueño: los demás piden un link que vence (`lib/cv.ts`). */
  cv_url: string | null;
  cv_filename: string | null;
  /** El CV subido, privado (ADR-0021, actualización 2026-11-19). Sólo lo
   * recibe el dueño, para mandarlo de vuelta al guardar: no abre el archivo.
   * Opcional porque una respuesta vieja (o un mock) puede no traerlo. */
  cv_file?: CvFileRef | null;
  /** Qué CV hay, para quien lo puede ver: «file» (subido) o «link» (pegado).
   * `null` si no hay o si quien mira no lo puede ver. */
  cv_kind?: "file" | "link" | null;
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

/** Respuesta de `GET /workers/me/earnings` (pedido de Julieta: "un resumen
 * de ganancias acumuladas en el perfil ... por mes"). Cuenta turnos
 * FINALIZADO/PAGADO — ya trabajados, cuenten o no todavía como "cobrados"
 * en el sistema (mismo criterio que `shifts_together` en favoritos). Los
 * montos vienen como string (`Decimal` del backend, ver `ShiftResponse`). */
export interface WorkerEarnings {
  total_earned: string;
  this_month_earned: string;
  shifts_completed: number;
}

export type NotificationType =
  | "shift_assigned"
  | "shift_confirmed"
  | "shift_rejected"
  | "shift_checked_out"
  | "shift_paid"
  | "shift_finished"
  | "shift_auto_finished"
  | "shift_finish_reminder"
  | "shift_reopened"
  | "chat_message"
  | "review_received"
  | "new_applicant"
  | "shift_no_show"
  | "shift_cancelled_late"
  | "shift_cancelled"
  | "applied_shift_cancelled"
  | "applications_withdrawn"
  | "applied_shift_changed"
  | "shift_not_covered"
  | "checkin_reminder"
  | "worker_not_checked_in"
  | "arrival_marked_by_company"
  | "departure_reminder"
  | "reconfirm_request"
  | "worker_not_reconfirmed"
  | "worker_en_route"
  | "new_shift_nearby"
  | "urgent_shift_nearby"
  | "support_reply"
  | "verification_decided"
  | "subscription_paid"
  | "subscription_expiring"
  | "subscription_expired"
  | "subscription_refunded";

export type ApplicationStatus =
  | "pendiente"
  | "aceptada"
  | "rechazada"
  | "retirada"
  // Tuvo el turno asignado y lo dejó: lleva su `motivo` (G4).
  | "desasignada";

/** Por qué dejó el turno quien lo tenía asignado (`status: "desasignada"`). */
export type UnassignedReason = "rechazo" | "cancelacion" | "ausencia";

export interface ShiftApplication {
  id: string;
  shift_id: string;
  worker_profile_id: string;
  status: ApplicationStatus;
  /** Sólo con `status: "desasignada"`. */
  motivo?: UnassignedReason | null;
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
  /** Sólo con `status: "desasignada"`: va al final de la lista, con su marca. */
  motivo?: UnassignedReason | null;
  created_at: string | null;
  events_completed: number;
  punctuality_rate: number;
  years_experience: number;
  badges: string[];
  level: string;
  /** Documento aprobado por un admin (mismo sello que en los recomendados). */
  identidad_verificada: boolean;
  /** Por qué está donde está en la lista (ADR-0031): la ordena el backend. */
  es_favorito: boolean;
  /** Ya terminó al menos un turno en este comercio. */
  trabajo_aca: boolean;
  /** Turnos terminados en Oído en el puesto de este turno. */
  turnos_en_el_puesto: number;
  /** Sello «Nuevo en Oído · identidad verificada»: sin turnos hechos, con la
   *  identidad verificada y sin ausencias. */
  nuevo_verificado: boolean;
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

// Ficha de una persona en el panel de admin (`GET /admin/users/{id}`).
export interface AdminWorkerSummary {
  city: string | null;
  skills: string[];
  years_experience: number;
  is_available: boolean;
  rating: number;
  events_completed: number;
  punctuality_rate: number;
  cancellations: number;
  no_shows: number;
  level: string;
}

export interface AdminCompanySummary {
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  rating: number;
  events_published: number;
  on_time_payment_rate: number;
  /** Pagos registrados detrás de la tasa; 0 = «Pago a tiempo» sin datos. Falta en respuestas viejas/cacheadas. */
  payments_recorded?: number;
  late_cancellations: number;
}

export interface AdminUserDetail {
  user: AdminUser;
  worker: AdminWorkerSummary | null;
  company: AdminCompanySummary | null;
  recent_shifts: {
    id: string;
    title: string | null;
    position: string;
    start_at: string;
    status: string;
    pay_amount: string;
    /** Lo que se cobra (`Shift.amount_due`): difiere de `pay_amount` en un
     *  turno reofrecido con la llegada marcada (U080). */
    amount_due?: string;
    /** La persona de la ficha faltó a este turno (ya no figura asignada). */
    absent?: boolean;
    /** «Cerrar turno» (decisión 21): sólo en la ficha de una cuenta
     * suspendida y en los turnos donde aplica; lo decide el backend. */
    admin_close?: AdminCloseAction | null;
  }[];
  tickets: { id: string; subject: string; status: string; created_at: string | null }[];
  /** Sólo en la ficha de un comercio (medición de la beta, M6). */
  subscription?: AdminSubscriptionSummary | null;
}

/** Bloque «Plan» de la ficha de un comercio. */
export interface AdminSubscriptionSummary {
  plan_code: string;
  plan_name: string;
  /** El plan que eligió en los precios de la landing al darse de alta. */
  chosen_plan_code: string | null;
  chosen_plan_name: string | null;
  chosen_plan_at: string | null;
  /** Compromiso de pago («precio fundador») que registró la admin. */
  commitment: {
    at: string;
    plan_code: string;
    plan_name: string;
    price_ars: number | string;
  } | null;
}

/** Qué haría «Cerrar turno» de la admin en un turno empezado de una cuenta
 * suspendida (decisión 21, ADR-0024). */
export interface AdminCloseAction {
  /** Marca la salida en nombre del trabajador suspendido. */
  check_out: boolean;
  /** Cierra el turno en nombre del comercio suspendido. */
  finish: boolean;
  /** A quién se le avisa: sólo a la parte con la cuenta activa. */
  notifies: "company" | "worker" | null;
}

/** Respuesta de `POST /admin/shifts/{id}/close`. */
export interface AdminShiftClosure extends AdminCloseAction {
  shift_id: string;
  status: string;
  checked_out_at: string | null;
}

/** Cuántos turnos toca suspender una cuenta (ADR-0024), antes de confirmar. */
export interface SuspensionPreview {
  /** Turnos abiertos del comercio que dejan de verse (vuelven si se reactiva). */
  hidden: number;
  /** Turnos del comercio con alguien asignado o confirmado: se cancelan con aviso. */
  cancelled: number;
  /** Turnos del trabajador que vuelven a buscar personal, con aviso al comercio. */
  reopened: number;
}

export interface TestAccount {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
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

  // Métricas de producto (docs/audits/OBSERVABILITY_AND_PRODUCT_ANALYTICS.md
  // §6), ya calculadas por el backend — `null` sin muestra (denominador 0).
  shift_assignment_rate_sample_size: number;
  shift_assignment_rate_pct: number | null;

  shift_completion_rate_sample_size: number;
  shift_completion_rate_pct: number | null;

  application_acceptance_sample_size: number;
  application_to_acceptance_rate_pct: number | null;

  no_show_sample_size: number;
  no_show_rate_pct: number | null;

  worker_completion_repeat_sample_size: number;
  worker_completion_repeat_rate_pct: number | null;

  /** Comercios con un turno cubierto que publicaron otro dentro de los 30 días. */
  employer_return_30d_sample_size: number;
  employer_return_30d_rate_pct: number | null;
}

/** Un turno de "Turnos en vivo" (`GET /admin/live-shifts`): publicado y
 * todavía sin nadie confirmado. */
export interface LiveShift {
  id: string;
  title: string | null;
  position: WorkerSkill;
  status: ShiftStatus;
  start_at: string;
  end_at: string;
  city: string | null;
  company_name: string | null;
  /** Lo marcó el comercio o lo escaló el sistema. */
  urgent: boolean;
  /** El sistema lo escaló por no cubrirse rápido. */
  escalated: boolean;
  escalated_at: string | null;
  published_at: string;
  /** Minutos desde que se publicó, calculados por el backend. */
  minutes_open: number;
  /** Postulaciones no retiradas. */
  applications: number;
  /** Cuándo se marcó la ausencia (sólo si el turno tuvo una). */
  no_show_at?: string | null;
}

export interface LiveShiftsBoard {
  generated_at: string;
  /** Totales de la lista completa, sin el filtro pedido. */
  total: number;
  urgent: number;
  escalated: number;
  /** Ausencias del día argentino de hoy. */
  no_shows?: number;
  /** Cuántos turnos en vivo entraron en la lista (tope del servidor): si es
   *  menor que `total`, faltan los más viejos. */
  shown_live?: number;
  limit?: number;
  shifts: LiveShift[];
}

/** Contadores extra de "Hoy" (`GET /admin/today`). */
export interface AdminTodayCounts {
  urgent_uncovered: number;
  no_shows_today: number;
}

export interface PeriodSummary {
  start: string;
  end: string;
  shifts_published: number;
  shifts_covered: number;
  covered_pct: number | null;
  covered_under_10_min_pct: number | null;
  avg_minutes_to_cover: number | null;
  applications: number;
  /** Cubierto = la persona confirmó. */
  median_minutes_to_cover: number | null;
  /** Cubiertos de un turno que empezaba dentro de las 24 h de publicado. */
  short_notice_covered: number;
  short_notice_under_10_min_pct: number | null;
  /** Cubiertos con check-in en el local. */
  fulfilled: number;
  fulfilled_pct: number | null;
  /** Comercios distintos que publicaron en el período. */
  active_companies: number;
  companies_with_covered: number;
}

/** "Métricas" con período (`GET /admin/period-metrics?period=7|30`). */
/** Altas del período que llegaron por un origen (`?ref=`, `utm_*` o
 *  «directo»). `origin: null` = cuentas de antes de que se guardara. */
export interface SignupsByOrigin {
  origin: string | null;
  workers: number;
  companies: number;
  total: number;
}

export interface PeriodMetrics {
  days: number;
  current: PeriodSummary;
  previous: PeriodSummary;
  /** Fase 0 del plan de crecimiento; falta en un backend anterior. */
  signups_by_origin?: SignupsByOrigin[];
}

/** Una semana de la serie M7 (`GET /admin/weekly-metrics`): de lunes a
 *  domingo en hora argentina, con las mismas definiciones que el período y
 *  cada turno en la semana en que se publicó. */
export interface WeekSummary {
  start: string;
  end: string;
  /** Es la semana de hoy: todavía no terminó. */
  in_progress: boolean;
  shifts_published: number;
  shifts_covered: number;
  covered_pct: number | null;
  fulfilled: number;
  fulfilled_pct: number | null;
  median_minutes_to_cover: number | null;
  short_notice_covered: number;
  short_notice_under_10_min_pct: number | null;
  active_companies: number;
  companies_with_covered: number;
  signups_workers: number;
  signups_companies: number;
  signups_by_origin: SignupsByOrigin[];
}

/** Serie semanal M7: de la semana más vieja a la de hoy. */
export interface WeeklyMetrics {
  weeks: WeekSummary[];
}

export interface SubscriptionStats {
  mrr_ars: number | string;
  total_companies: number;
  /** Cantidad de comercios por `plan_code` (incluye a los que todavía no
   * tienen fila en `subscriptions`, contados en el plan por defecto, `inicial`). */
  companies_by_plan: Record<string, number>;
  companies_at_plan_limit: number;
  /** Comercios por plan elegido al darse de alta (sin cuentas de prueba). */
  companies_with_chosen_plan?: Record<string, number>;
  /** Comercios con compromiso de pago y suma de sus precios mensuales. */
  committed_companies?: number;
  committed_mrr_ars?: number | string;
  /** False mientras no haya credenciales de Mercado Pago: `mrr_ars` es
   * entonces un monto POTENCIAL (lo que se cobraría), nunca ingreso real —
   * el panel lo tiene que mostrar distinguible (auditoría 2026-08-15, F1). */
  billing_enabled: boolean;
}

// Fase 1 de ADR-0005 (mensualidad al comercio). Contrato de API congelado,
// construido en paralelo por el backend — no inventar campos ni endpoints.
export type SubscriptionStatus = "pendiente" | "activa" | "vencida" | "cancelada" | string;

export interface Subscription {
  plan_code: string;
  status: SubscriptionStatus;
  period_end: string | null;
  price_ars: number | string;
  /** `null` = ilimitado. */
  max_turnos_mes: number | null;
  turnos_usados_mes: number;
  /** Cobro real con Mercado Pago prendido (ADR-0022). En false, el resto de
   * los campos de cobro no aplica y la pantalla se ve como en la beta. */
  billing_enabled?: boolean;
  /** Hasta cuándo está pago el plan (con el cobro prendido). */
  paid_until?: string | null;
  /** False = dio de baja: no renueva, sigue hasta `paid_until`. */
  renews?: boolean;
  /** Si hoy puede publicar turnos por el plan (pago y vigente). */
  can_publish?: boolean;
  /** ¿El tope de turnos se hace cumplir? En la beta es false: el uso se
   * cuenta pero no hay tope (G11). Ausente = como si se exigiera. */
  limite_exigido?: boolean;
  /** Último día (AAAA-MM-DD, hora argentina) para arrepentirse; null si no aplica. */
  withdrawal_until?: string | null;
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
  cover_photo_url?: string | null;
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
  /** Pagos registrados detrás de la tasa; 0 = «Pago a tiempo» sin datos. Falta en respuestas viejas/cacheadas. */
  payments_recorded?: number;
  late_cancellations: number;
}

export type TicketCategory =
  | "general"
  | "cv_documentos"
  | "pagos"
  | "cuenta"
  | "turno"
  | "comercio"
  | "otro";
export type TicketStatus = "abierto" | "cerrado";

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  general: "General",
  cv_documentos: "CV / Documentos",
  pagos: "Pagos",
  cuenta: "Mi cuenta",
  turno: "Un turno",
  comercio: "Un comercio",
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
  /** U110: turno y/o comercio al que se refiere el ticket (opcionales). */
  shift_id?: string | null;
  company_id?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Lo que un ticket tiene atado, para mostrarlo (`GET /support/reference` y el detalle). */
export interface SupportReferences {
  shift: { id: string; title: string; start_at: string; company_name: string | null } | null;
  company: {
    id: string;
    name: string;
    /** Cuenta dueña del comercio: sólo la ve el admin (su ficha). */
    user_id: string | null;
  } | null;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: SupportMessage[];
  references?: SupportReferences | null;
  /** Quién abrió el ticket: sólo viene para el admin (no-disclosure). */
  opened_by?: { user_id: string; full_name: string; role: string } | null;
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
  shift_id?: string | null;
  shift_title?: string | null;
  shift_start_at?: string | null;
  company_id?: string | null;
  company_name?: string | null;
}

// Comercios a captar para la beta (`/admin/leads`, ADR-0019).
export type LeadStatus =
  | "nuevo"
  | "contactado"
  | "visitado"
  | "interesado"
  | "alta"
  | "descartado";

export type LeadKind = "restaurante" | "bar" | "cafe" | "comida_rapida" | "heladeria";

export interface Lead {
  id: string;
  osm_ref: string;
  name: string;
  kind: LeadKind;
  barrio: string;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  email: string | null;
  status: LeadStatus;
  notes: string;
  priority: number;
  contacted_at: string | null;
  updated_at: string | null;
}

export interface LeadSummary {
  counts: Record<LeadStatus, number>;
  total: number;
  /** De cuándo es la copia de OpenStreetMap de cada barrio que tiene una
   *  (ISO, UTC). Un barrio que no está todavía no tiene copia (ADR-0029). */
  snapshots?: Record<string, string>;
}

export interface LeadImportResult {
  barrio: string;
  found: number;
  created: number;
  updated: number;
  /** De cuándo es la copia de OpenStreetMap que se importó (ISO, UTC). */
  fetched_at?: string | null;
}
