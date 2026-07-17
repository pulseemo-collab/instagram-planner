import type { IgProfile } from "@/lib/instagram/types";
import { LinkIcon, ThreadsIcon, VerifiedIcon } from "./icons";

export interface ProfileBioProps {
  profile: Pick<
    IgProfile,
    "fullName" | "isVerified" | "category" | "bioLines" | "website" | "threadsUsername"
  >;
}

export function ProfileBio({ profile }: ProfileBioProps) {
  return (
    <div className="px-4 text-[14px] leading-[18px]">
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-(--ig-text)">{profile.fullName}</span>
        {profile.isVerified && <VerifiedIcon size={14} className="shrink-0" />}
      </div>

      {profile.threadsUsername && (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-(--ig-button) px-2.5 py-1 text-[12px] font-medium text-(--ig-text)">
          <ThreadsIcon size={12} aria-hidden="true" />
          {profile.threadsUsername}
        </span>
      )}

      {profile.category && (
        <p className="text-(--ig-text-secondary)">{profile.category}</p>
      )}

      {profile.bioLines.map((line, index) => (
        <p key={index} className="text-(--ig-text)">
          {line}
        </p>
      ))}

      {profile.website && (
        <a
          href={`https://${profile.website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 flex items-center gap-1 font-semibold text-(--ig-link)"
        >
          <LinkIcon size={13} className="shrink-0 -rotate-45" />
          {profile.website}
        </a>
      )}
    </div>
  );
}
