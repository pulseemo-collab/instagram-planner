"use client";

import { isSupabaseConfigured } from "@/lib/supabase/env";

const DEMO_SESSION_KEY = "gridline-demo-session";

export type AuthMode = "demo" | "supabase";

export function authMode(): AuthMode {
  return isSupabaseConfigured() ? "supabase" : "demo";
}

/**
 * Who the demo session plays: the workspace owner (the full demo), or a
 * freshly signed-up account that is still waiting for the owner's approval.
 */
export type DemoSessionVariant = "owner" | "pending";

function readDemoSession(): string | null {
  try {
    return localStorage.getItem(DEMO_SESSION_KEY);
  } catch {
    return null;
  }
}

export function hasDemoSession(): boolean {
  const value = readDemoSession();
  return value === "1" || value === "pending";
}

export function demoSessionVariant(): DemoSessionVariant {
  return readDemoSession() === "pending" ? "pending" : "owner";
}

export function startDemoSession(variant: DemoSessionVariant = "owner"): void {
  localStorage.setItem(DEMO_SESSION_KEY, variant === "pending" ? "pending" : "1");
}

export function endDemoSession(): void {
  localStorage.removeItem(DEMO_SESSION_KEY);
}
