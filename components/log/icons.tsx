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
  press: MessageCircle,
  role: Briefcase,
  event: Dot,
};

/** Per-commit icon overrides keyed by the optional `icon` field. */
export const commitIconOverrides: Record<string, LucideIcon> = {
  "graduation-cap": GraduationCap,
};

/**
 * The mark a commit wears: its own `icon` override if it names one this
 * module knows, otherwise the one its type wears.
 *
 * Both tables are exported, so the resolution order used to be written out
 * at each of the three surfaces that draw the mark — the /works row, the
 * home widget, the toolbar's chips — all having to agree that a chip and
 * the rows it selects never wear different marks. A component rather than
 * a resolver returning one, because a call whose result is rendered as a
 * component is exactly what `react-hooks/static-components` warns about,
 * and the shared thing here is the mark itself, not the lookup.
 */
export function CommitIcon({
  type,
  override,
  className,
}: {
  type: CommitType;
  override?: string;
  className?: string;
}) {
  const Icon = (override && commitIconOverrides[override]) || commitIcons[type];
  return <Icon className={className} />;
}
