import { cn } from "@/lib/cn";

interface BrandAvatarProps {
  initials: string;
  bg: string;
  fg: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses: Record<NonNullable<BrandAvatarProps["size"]>, string> = {
  sm: "size-8 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-12 text-sm",
};

export function BrandAvatar({ initials, bg, fg, size = "md", className }: BrandAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide select-none",
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      {initials}
    </span>
  );
}
