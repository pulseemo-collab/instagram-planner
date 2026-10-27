"use client";

import { workspaceStore } from "@/lib/store/workspace-store";
import { authMode, endDemoSession } from "./session";

/** End the Supabase or demo session and forget the loaded workspace. */
export async function signOut(): Promise<void> {
  if (authMode() === "supabase") {
    const { getBrowserSupabase } = await import("@/lib/supabase/client");
    await getBrowserSupabase().auth.signOut();
  } else {
    endDemoSession();
  }
  await workspaceStore.reset();
}
