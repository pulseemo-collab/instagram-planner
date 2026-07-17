import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Repository } from "./types";

let instance: Repository | null = null;

/** Singleton repository — Supabase when configured, demo (IndexedDB) otherwise. */
export async function getRepository(): Promise<Repository> {
  if (!instance) {
    if (isSupabaseConfigured()) {
      const { SupabaseRepository } = await import("./supabase-repository");
      instance = new SupabaseRepository();
    } else {
      const { DemoRepository } = await import("./demo-repository");
      instance = new DemoRepository();
    }
  }
  return instance;
}

export { isShareError } from "./types";
export type { Repository, WorkspaceSnapshot, UploadResult, ShareError, ShareResolution } from "./types";
