import type { IgAvatar } from "@/lib/instagram/types";
import { CreateIcon, HomeIcon, ReelsIcon, SearchIcon } from "./icons";
import { MediaArt } from "./media-art";

export interface BottomNavigationProps {
  avatar: IgAvatar;
  /** Which slot is active; the profile screen defaults to "profile". */
  active?: "home" | "search" | "create" | "reels" | "profile";
}

export function BottomNavigation({ avatar, active = "profile" }: BottomNavigationProps) {
  const iconClass = "flex flex-1 items-center justify-center";

  return (
    <nav
      aria-label="Instagram navigation"
      className="flex h-[48px] items-center border-t border-(--ig-border) bg-(--ig-bg) text-(--ig-text)"
    >
      <button type="button" aria-label="Home" className={iconClass}>
        <HomeIcon size={25} active={active === "home"} />
      </button>
      <button type="button" aria-label="Search" className={iconClass}>
        <SearchIcon size={25} />
      </button>
      <button type="button" aria-label="Create" className={iconClass}>
        <CreateIcon size={25} />
      </button>
      <button type="button" aria-label="Reels" className={iconClass}>
        <ReelsIcon size={25} />
      </button>
      <button type="button" aria-label="Profile" className={iconClass}>
        <span
          className={`relative block size-[26px] overflow-hidden rounded-full ${
            active === "profile" ? "ring-2 ring-(--ig-text)" : ""
          }`}
        >
          <MediaArt art={avatar.placeholder} imageUrl={avatar.imageUrl} alt="" />
        </span>
      </button>
    </nav>
  );
}
