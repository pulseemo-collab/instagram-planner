import { formatCount } from "@/lib/instagram/format";
import type { IgProfile } from "@/lib/instagram/types";

export interface ProfileStatsProps {
  profile: Pick<IgProfile, "postCount" | "followerCount" | "followingCount">;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <button type="button" className="flex flex-1 flex-col items-center gap-px">
      <span className="text-[17px] font-bold leading-[22px] text-(--ig-text)">
        {formatCount(value)}
      </span>
      <span className="text-[13px] leading-[16px] text-(--ig-text)">{label}</span>
    </button>
  );
}

export function ProfileStats({ profile }: ProfileStatsProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center">
      <Stat value={profile.postCount} label="posts" />
      <Stat value={profile.followerCount} label="followers" />
      <Stat value={profile.followingCount} label="following" />
    </div>
  );
}
