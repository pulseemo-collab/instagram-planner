import type { NextConfig } from "next";

/**
 * The app's mode (demo vs Supabase live) is frozen at BUILD time. The value
 * below is inlined into both the server and client bundles, so a stale build
 * can never end up with a live-mode proxy and a demo-mode client at the same
 * time (audit BUG-002). Changing `.env.local` requires a rebuild — see
 * `.env.example`.
 */
const builtWithSupabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? "1"
    : "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILT_WITH_SUPABASE: builtWithSupabase,
  },
};

export default nextConfig;
