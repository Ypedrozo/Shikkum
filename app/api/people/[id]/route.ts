import { authorizedApi, safeError } from "@/lib/server";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
 const auth=await authorizedApi(["ADMIN"]); if("error" in auth)return auth.error;
 try {
  const {id}=await context.params; const {status}=await request.json();
  if(!["pending","cancelled"].includes(status))return Response.json({error:"Estado no válido."},{status:400});
  const {data,error}=await auth.supabase.from("participants").update({status}).eq("id",id).neq("status","checked_in").select("id");
  if(error)throw error; if(!data?.length)return Response.json({error:"No se puede modificar una persona que ya ingresó."},{status:409});
  return Response.json({ok:true});
 }catch(e){return Response.json({error:safeError(e)},{status:500});}
}
