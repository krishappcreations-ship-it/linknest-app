import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Create the redirect response first so we can write auth cookies directly
  // onto it. cookies().set() in route handlers is NOT guaranteed to propagate
  // to a separately-created NextResponse.redirect() object.
  const response = NextResponse.redirect(origin);

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (
            all: Array<{ name: string; value: string; options: CookieOptions }>
          ) =>
            all.forEach((c) =>
              response.cookies.set(c.name, c.value, c.options)
            ),
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession:", error.message);
      const errUrl = new URL(origin);
      errUrl.searchParams.set("auth_error", error.message);
      return NextResponse.redirect(errUrl);
    }
  }

  return response;
}
