"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

let client: SupabaseClient | null = null;

/** Browser Supabase client (anon key only — never the service role). */
export function getBrowserSupabase(): SupabaseClient {
  if (!client) {
    const url = supabaseUrl();
    const key = supabaseAnonKey();
    if (!url || !key) {
      throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }
    client = createBrowserClient(url, key);
  }
  return client;
}
