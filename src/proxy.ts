import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh + optimistic auth redirects. Active only when Supabase is
 * configured; demo mode handles its session entirely client-side.
 *
 * Activation is gated on NEXT_PUBLIC_BUILT_WITH_SUPABASE — a flag frozen at
 * build time (next.config.ts) — so the proxy's mode always matches the mode
 * inlined into the client bundle. Runtime-only env changes without a rebuild
 * therefore leave the app consistently in its built mode (audit BUG-002).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.NEXT_PUBLIC_BUILT_WITH_SUPABASE !== "1" || !url || !key) {
    return NextResponse.next();
  }

  const { createServerClient } = await import("@supabase/ssr");
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isPublic = isAuthPage || pathname.startsWith("/share/");

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }
  if (user && isAuthPage) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)"],
};
