import React, { type ComponentType } from "react";
import {
  Activity,
  Bell,
  BookOpenText,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Crown,
  Flame,
  HandHeart,
  Hash,
  HeartHandshake,
  House,
  IndianRupee,
  Languages,
  Leaf,
  LogOut,
  Moon,
  Palette,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  UserRound,
  Users,
  X,
  type LucideProps
} from "lucide-react-native";

const iconMap: Record<string, ComponentType<LucideProps>> = {
  activity: Activity,
  alert: CircleAlert,
  bell: Bell,
  book: BookOpenText,
  briefcase: BriefcaseBusiness,
  calendar: CalendarDays,
  check: Check,
  chevron: ChevronRight,
  clock: Clock3,
  crown: Crown,
  family: Users,
  flame: Flame,
  handHeart: HandHeart,
  hash: Hash,
  heart: HeartHandshake,
  home: House,
  language: Languages,
  leaf: Leaf,
  logout: LogOut,
  money: IndianRupee,
  moon: Moon,
  palette: Palette,
  profile: UserRound,
  settings: Settings,
  shield: ShieldCheck,
  sparkle: Sparkles,
  star: Star,
  sun: Sun,
  sunrise: Sunrise,
  sunset: Sunset,
  trash: Trash2,
  x: X
};

type AppIconProps = LucideProps & { name: string };

export function AppIcon({ name, ...props }: AppIconProps) {
  const Icon = iconMap[name] ?? Sparkles;
  return <Icon accessibilityElementsHidden {...props} />;
}
