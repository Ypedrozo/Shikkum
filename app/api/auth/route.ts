import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export async function POST(request: Request) {
 const supabase=await createClient(); const form=await request.formData();
 const {error}=await supabase.auth.signInWithPassword({email:String(form.get("email")??""),password:String(form.get("password")??"")});
 if(error)return Response.redirect(new URL("/login?error=invalid",request.url));
 return Response.redirect(new URL("/",request.url));
}
export async function DELETE() { const supabase=await createClient(); await supabase.auth.signOut(); redirect("/login"); }
