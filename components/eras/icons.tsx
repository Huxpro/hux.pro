import {
  Package,
  Mic,
  FileText,
  MessageCircle,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { type WorkItemType } from "@/lib/eras";

export const itemIcons: Record<WorkItemType, LucideIcon> = {
  project: Package,
  talk: Mic,
  post: FileText,
  social: MessageCircle,
  role: Briefcase,
};
