import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const requestedNext = url.searchParams.get("next") ?? "/teams/new";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/teams/new";
  const destination = new URL(next, url.origin);
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(destination);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" | "signup" | "invite" | "magiclink" | "recovery" | "email_change" });
    if (!error) return NextResponse.redirect(destination);
  }
  destination.pathname = "/auth/sign-in";
  destination.searchParams.set("error", "confirmation");
  return NextResponse.redirect(destination);
}
