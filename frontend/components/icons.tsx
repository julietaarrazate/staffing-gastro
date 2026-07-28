/**
 * Iconografía de Staffya: set oficial de **Lucide** (rounded, minimalista).
 * Se re-exporta bajo los nombres históricos para no tocar los imports de las
 * pantallas. Todos heredan el color con `currentColor`, tamaño con `size` y
 * trazo 1.75. `StarIcon` admite `filled` para el rating.
 */
import type { ComponentType } from "react";
import {
  AlertTriangle,
  Award,
  Bell,
  Bike,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Eye,
  EyeOff,
  Car,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Coffee,
  Copy,
  CreditCard,
  Flame,
  Footprints,
  Home,
  type LucideProps,
  LogOut,
  MapPin,
  Medal,
  MessageCircle,
  Play,
  Route,
  Search,
  Send,
  Share2,
  Shield,
  Sparkles,
  Star,
  Users,
  Wallet,
  Wine,
  X,
  XCircle,
  Zap,
} from "lucide-react";

export type IconProps = LucideProps & { size?: number; filled?: boolean };

function make(LucideIcon: ComponentType<LucideProps>) {
  function Icon({ size = 20, strokeWidth = 1.75, filled, ...props }: IconProps) {
    return (
      <LucideIcon
        size={size}
        strokeWidth={strokeWidth}
        fill={filled ? "currentColor" : "none"}
        {...props}
      />
    );
  }
  return Icon;
}

export const BoltIcon = make(Zap);
export const MapPinIcon = make(MapPin);
export const SearchIcon = make(Search);
export const MessageIcon = make(MessageCircle);
export const BellIcon = make(Bell);
export const StarIcon = make(Star);
export const CheckIcon = make(Check);
export const CheckCircleIcon = make(CheckCircle2);
export const ClockIcon = make(Clock);
export const CalendarIcon = make(Calendar);
export const UsersIcon = make(Users);
export const WalletIcon = make(Wallet);
export const FlameIcon = make(Flame);
export const PlayIcon = make(Play);
export const RouteIcon = make(Route);
export const ShieldIcon = make(Shield);
export const SendIcon = make(Send);
export const ChevronLeftIcon = make(ChevronLeft);
export const ChevronRightIcon = make(ChevronRight);
export const ClipboardIcon = make(ClipboardList);
export const BriefcaseIcon = make(Briefcase);
export const BuildingIcon = make(Building2);
export const LogOutIcon = make(LogOut);
export const HomeIcon = make(Home);
export const CoffeeIcon = make(Coffee);
export const GlassIcon = make(Wine);
export const ChefHatIcon = make(ChefHat);
export const CameraIcon = make(Camera);
export const EyeIcon = make(Eye);
export const EyeOffIcon = make(EyeOff);
export const CloseIcon = make(X);
export const FootprintsIcon = make(Footprints);
export const BikeIcon = make(Bike);
export const CarIcon = make(Car);
export const AwardIcon = make(Award);
export const MedalIcon = make(Medal);
export const XCircleIcon = make(XCircle);
export const CreditCardIcon = make(CreditCard);
export const AlertTriangleIcon = make(AlertTriangle);
export const SparklesIcon = make(Sparkles);
export const ShareIcon = make(Share2);
export const CopyIcon = make(Copy);
