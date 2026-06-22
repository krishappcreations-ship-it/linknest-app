import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { decideGate } from "@/lib/auth/route-gate";

/**
 * Gates the marketing landing page vs. the app.
 *
 * Reads the Supabase session from cookies (same library + env the OAuth callback
 * uses) and applies the pure `decideGate` decision. Matcher is scoped to just `/`
 * and `/welcome` so the rest of the app — including the SPA routes and
 * `/auth/callback` — is never touched.
 *
 * If Supabase env is absent (e.g. local without sync configured) we treat the
 * visitor as anonymous, which surfaces the landing page rather than 500ing.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cookie writes from token refresh must land on the response we return.
  const response = NextResponse.next({ request });

  let hasSession = false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          all: Array<{ name: string; value: string; options: CookieOptions }>
        ) =>
          all.forEach((c) => response.cookies.set(c.name, c.value, c.options)),
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSession = !!user;
  }

  const decision = decideGate(hasSession, pathname);

  if (decision.action === "rewrite" || decision.action === "redirect") {
    const target = request.nextUrl.clone();
    target.pathname = decision.to;
    const next =
      decision.action === "rewrite"
        ? NextResponse.rewrite(target)
        : NextResponse.redirect(target);
    // Carry any refreshed auth cookies onto the new response.
    response.cookies.getAll().forEach((c) => next.cookies.set(c));
    return next;
  }
  return response;
}

export const config = {
  matcher: ["/", "/welcome"],
};
