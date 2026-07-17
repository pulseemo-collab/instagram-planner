import type { IgProfile } from "@/lib/instagram/types";
import { ChevronDownIcon, CreateIcon, LockIcon, MenuIcon, ThreadsIcon } from "./icons";

export interface TopBarProps {
  profile: Pick<IgProfile, "username" | "isPrivate">;
}

export function TopBar({ profile }: TopBarProps) {
  return (
    <div className="flex h-[44px] items-center justify-between bg-(--ig-bg) px-4">
      <button
        type="button"
        className="flex min-w-0 items-center gap-1.5 text-(--ig-text)"
        aria-label={`Switch account, current account ${profile.username}`}
      >
        {profile.isPrivate && <LockIcon size={16} />}
        <span className="truncate text-[22px] font-bold leading-none tracking-[-0.01em]">
          {profile.username}
        </span>
        <ChevronDownIcon size={14} className="mt-0.5 shrink-0" />
      </button>

      <div className="flex items-center gap-[22px] text-(--ig-text)">
        <button type="button" aria-label="Open Threads">
          <ThreadsIcon size={24} />
        </button>
        <button type="button" aria-label="Create new content">
          <CreateIcon size={24} />
        </button>
        <button type="button" aria-label="Open menu">
          <MenuIcon size={24} />
        </button>
      </div>
    </div>
  );
}
