import type { IgTabId } from "@/lib/instagram/types";
import { GridIcon, ReelsIcon, RepostIcon, TagPersonIcon } from "./icons";

export interface ProfileTabsProps {
  activeTab: IgTabId;
  onTabChange: (tab: IgTabId) => void;
}

const tabs: Array<{ id: IgTabId; label: string; icon: typeof GridIcon }> = [
  { id: "posts", label: "Posts", icon: GridIcon },
  { id: "reels", label: "Reels", icon: ReelsIcon },
  { id: "reposts", label: "Reposts", icon: RepostIcon },
  { id: "tagged", label: "Tagged", icon: TagPersonIcon },
];

export function ProfileTabs({ activeTab, onTabChange }: ProfileTabsProps) {
  return (
    <div role="tablist" aria-label="Profile content" className="flex h-[44px] bg-(--ig-bg)">
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={tab.label}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex flex-1 items-center justify-center ${
              active ? "text-(--ig-text)" : "text-(--ig-text-secondary)"
            }`}
          >
            <tab.icon size={24} />
            {active && (
              <span className="absolute inset-x-0 bottom-0 h-px bg-(--ig-text)" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}
