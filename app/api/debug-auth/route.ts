import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Diagnostic endpoint — DELETE after debugging
export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  // Check env vars
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? `SET (${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...)`
      : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING",
  };

  // List all cookies (names only for security)
  const cookieNames = allCookies.map((c) => ({
    name: c.name,
    valueLength: c.value.length,
    valuePreview: c.value.substring(0, 30) + "...",
  }));

  // Try to get user via server client
  let userResult: unknown = null;
  let userError: unknown = null;

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // Server Component context
              }
            },
          },
        }
      );

      const { data, error } = await supabase.auth.getUser();
      userResult = data?.user
        ? { id: data.user.id, email: data.user.email, role: data.user.role }
        : null;
      userError = error ? { message: error.message, status: error.status } : null;
    } catch (e) {
      userError = { message: String(e) };
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    envCheck,
    cookieCount: allCookies.length,
    cookies: cookieNames,
    user: userResult,
    authError: userError,
  });
}
