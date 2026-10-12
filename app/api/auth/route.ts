import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

type AuthCookie = Parameters<SetAllCookies>[0][number];

function createAuthClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan las variables públicas de Supabase.");

  const pendingCookies = new Map<string, AuthCookie>();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: Parameters<SetAllCookies>[0]) => {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          pendingCookies.set(cookie.name, cookie);
        }
      },
    },
  });

  return {
    supabase,
    attachCookies(response: NextResponse) {
      for (const { name, value, options } of pendingCookies.values()) {
        response.cookies.set(name, value, options);
      }
      return response;
    },
  };
}

export async function POST(request: NextRequest) {
  const { supabase, attachCookies } = createAuthClient(request);
  const form = await request.formData();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
  });

  const destination = error
    ? new URL("/login?error=invalid", request.url)
    : new URL("/", request.url);

  return attachCookies(NextResponse.redirect(destination, { status: 303 }));
}
