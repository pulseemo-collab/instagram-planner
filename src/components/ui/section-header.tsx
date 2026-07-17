import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  headingId?: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}

export function SectionHeader({
  title,
  headingId,
  description,
  href,
  linkLabel,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 id={headingId} className="text-[15px] font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>
        ) : null}
      </div>
      {href && linkLabel ? (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
        >
          {linkLabel}
          <ArrowUpRight
            className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );
}
