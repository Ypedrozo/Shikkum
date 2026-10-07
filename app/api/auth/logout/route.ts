import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
 const supabase=await createClient(); await supabase.auth.signOut();
 return Response.redirect(new URL("/login",request.url));
}
