import {
  Package,
  Mic,
  FileText,
  MessageCircle,
  Briefcase,
  Dot,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { type CommitType } from "@/lib/log";

export const commitIcons: Record<CommitType, LucideIcon> = {
  project: Package,
  talk: Mic,
  post: FileText,
  social: MessageCircle,
  role: Briefcase,
  event: Dot,
};

/** Per-commit icon overrides keyed by the optional `icon` field. */
export const commitIconOverrides: Record<string, LucideIcon> = {
  "graduation-cap": GraduationCap,
};
