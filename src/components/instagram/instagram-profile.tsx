"use client";

import { useState } from "react";
import type { IgProfile, IgTabId, IgTheme } from "@/lib/instagram/types";
import { BottomNavigation } from "./bottom-navigation";
import { Highlights } from "./highlights";
import { ProfileActions } from "./profile-actions";
import { ProfileBio } from "./profile-bio";
import { ProfileGrid } from "./profile-grid";
import { ProfileHeader } from "./profile-header";
import { ProfileTabs } from "./profile-tabs";
import { TopBar } from "./top-bar";

import type { GridEditing } from "./profile-grid";

export interface InstagramProfileProps {
  profile: IgProfile;
  theme?: IgTheme;
  className?: string;
  /** Opens a post's detail view. */
  onPostOpen?: (postId: string) => void;
  /** Workspace edit mode: enables grid reordering on the Posts tab. */
  gridEditing?: GridEditing;
}

/**
 * Full Instagram mobile profile screen. Owns only view state (active tab);
 * all data flows in through `profile`, so uploads/editing/scheduling can be
 * wired in later by swapping the data source.
 */
export function InstagramProfile({
  profile,
  theme = "light",
  className,
  onPostOpen,
  gridEditing,
}: InstagramProfileProps) {
  const [activeTab, setActiveTab] = useState<IgTabId>("posts");

  const mediaByTab: Record<IgTabId, typeof profile.posts> = {
    posts: profile.posts,
    reels: profile.reels,
    reposts: profile.reposts,
    tagged: profile.tagged,
  };

  return (
    <div
      className={`ig-root ${theme === "dark" ? "ig-dark" : "ig-light"} flex h-full flex-col bg-(--ig-bg) ${className ?? ""}`}
    >
      <TopBar profile={profile} />

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ProfileHeader profile={profile} />
        <ProfileBio profile={profile} />
        <ProfileActions />
        <Highlights highlights={profile.highlights} />

        <div className="sticky top-0 z-10">
          <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <ProfileGrid
          media={mediaByTab[activeTab]}
          tab={activeTab}
          onOpen={onPostOpen}
          editing={activeTab === "posts" ? gridEditing : undefined}
        />
      </div>

      <BottomNavigation avatar={profile.avatar} active="profile" />
    </div>
  );
}
