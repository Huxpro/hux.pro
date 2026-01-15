import {
  Package,
  Mic,
  FileText,
  MessageCircle,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { type CommitType } from "@/lib/log";

export const commitIcons: Record<CommitType, LucideIcon> = {
  project: Package,
  talk: Mic,
  post: FileText,
  social: MessageCircle,
  role: Briefcase,
};
