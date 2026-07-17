import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-panel/50 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-panel text-ink-faint shadow-panel">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-[14.5px] font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-soft">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
