import type { Theme } from "@/types/domain";

export interface AppPreferences {
  defaultTheme: Theme;
  defaultApprovals: "comments_and_approvals" | "comments_only" | "view_only";
}

const PREFS_KEY = "gridline-preferences";

const defaults: AppPreferences = {
  defaultTheme: "light",
  defaultApprovals: "comments_and_approvals",
};

export function getPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<AppPreferences>) };
  } catch {
    // corrupted storage → defaults
  }
  return defaults;
}

export function setPreferences(prefs: AppPreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
