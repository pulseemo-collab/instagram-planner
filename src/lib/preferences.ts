import type { Theme } from "@/types/domain";

export interface AppPreferences {
  defaultTheme: Theme;
  defaultApprovals: "comments_and_approvals" | "comments_only" | "view_only";
}

/** Browser-local (localStorage) — not synced across devices. */
export const PREFS_KEY = "gridline-preferences";

export const DEFAULT_PREFERENCES: AppPreferences = {
  defaultTheme: "light",
  defaultApprovals: "comments_and_approvals",
};

/** Parse the stored JSON; unknown or corrupted values fall back to defaults. */
export function parsePreferences(raw: string | null): AppPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const stored = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      defaultTheme: stored.defaultTheme === "dark" ? "dark" : "light",
      defaultApprovals:
        stored.defaultApprovals === "comments_only" || stored.defaultApprovals === "view_only"
          ? stored.defaultApprovals
          : "comments_and_approvals",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Current preferences, for code that runs after hydration (event handlers, dialogs). */
export function getPreferences(): AppPreferences {
  try {
    return parsePreferences(localStorage.getItem(PREFS_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Share-link permissions for an approval flow preference. */
export function approvalFlowFlags(flow: AppPreferences["defaultApprovals"]): {
  allowComments: boolean;
  allowApproval: boolean;
} {
  return {
    allowComments: flow !== "view_only",
    allowApproval: flow === "comments_and_approvals",
  };
}
