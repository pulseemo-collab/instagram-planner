import type { IgProfile } from "@/lib/instagram/types";
import { MediaArt } from "./media-art";
import { ProfileStats } from "./profile-stats";

export interface ProfileHeaderProps {
  profile: IgProfile;
}

/**
 * Avatar (with story ring when a story is live) next to the post/follower/
 * following stats — the first block under the top bar.
 */
export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const avatar = (
    <div className="relative size-[86px] overflow-hidden rounded-full">
      <MediaArt
        art={profile.avatar.placeholder}
        imageUrl={profile.avatar.imageUrl}
        alt={`${profile.username} profile picture`}
      />
      <div className="absolute inset-0 rounded-full border border-black/10" />
    </div>
  );

  return (
    <div className="flex items-center gap-6 px-4 pb-3 pt-2.5">
      <div className="relative shrink-0">
        {profile.note && (
          <span className="absolute -top-3 left-1/2 z-10 w-max max-w-[96px] -translate-x-1/2 rounded-2xl border border-(--ig-border) bg-(--ig-bg) px-2.5 py-1 text-center text-[10.5px] leading-[13px] text-(--ig-text-secondary) shadow-sm">
            {profile.note}
          </span>
        )}
        {profile.hasActiveStory ? (
        <button
          type="button"
          aria-label={`View ${profile.username}'s story`}
          className="shrink-0 rounded-full p-[2.5px]"
          style={{
            background: "linear-gradient(45deg, #f9ce34 0%, #ee2a7b 50%, #6228d7 100%)",
          }}
        >
          <span className="block rounded-full border-[2.5px] border-(--ig-bg)">{avatar}</span>
        </button>
        ) : (
          <div className="p-[5px]">{avatar}</div>
        )}
      </div>
      <ProfileStats profile={profile} />
    </div>
  );
}
