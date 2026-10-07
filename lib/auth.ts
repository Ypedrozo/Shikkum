import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export type Role = "ADMIN" | "SCANNER";
export async function getAccess() {
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return {supabase,user:null,role:null as Role|null};
 const {data}=await supabase.from("user_profiles").select("role").eq("id",user.id).maybeSingle();
 return {supabase,user,role:(data?.role as Role|undefined)??null};
}
export async function requireRole(required:Role[]) {
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)redirect("/setup");
 const access=await getAccess();
 if(!access.user||!access.role)redirect("/login");
 if(!required.includes(access.role))redirect("/scanner");
 return access as typeof access & {user:NonNullable<typeof access.user>;role:Role};
}
