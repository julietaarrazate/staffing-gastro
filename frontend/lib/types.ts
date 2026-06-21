export type UserRole = "worker" | "employer" | "admin";

export type WorkerSkill =
  | "mozo"
  | "bartender"
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
  created_at: string | null;
}

export interface CandidateMatch {
  profile_id: string;
  user_id: string;
  full_name: string;
  photo_url: string | null;
  rating: number;
  score: number;
  distance_km: number | null;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
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
  is_available: boolean;
  rating: number;
  events_completed: number;
  punctuality_rate: number;
  cancellations: number;
  badges: string[];
  level: string;
}

export type NotificationType =
  | "shift_assigned"
  | "shift_confirmed"
  | "shift_rejected";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string | null;
}

export interface CompanyProfile {
  id: string;
  user_id: string;
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
}
