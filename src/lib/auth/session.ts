"use client";

import { isSupabaseConfigured } from "@/lib/supabase/env";

const DEMO_SESSION_KEY = "gridline-demo-session";

export type AuthMode = "demo" | "supabase";

export function authMode(): AuthMode {
  return isSupabaseConfigured() ? "supabase" : "demo";
}

export function hasDemoSession(): boolean {
  try {
    return localStorage.getItem(DEMO_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function startDemoSession(): void {
  localStorage.setItem(DEMO_SESSION_KEY, "1");
}

export function endDemoSession(): void {
  localStorage.removeItem(DEMO_SESSION_KEY);
}
