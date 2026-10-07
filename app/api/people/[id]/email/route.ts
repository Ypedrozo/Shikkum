import { authorizedApi, safeError, sendQrEmail } from "@/lib/server";
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
 const auth=await authorizedApi(["ADMIN"]); if("error" in auth)return auth.error;
 try {
  const {id}=await context.params;
  const {data,error}=await auth.supabase.from("participants").select("first_name,last_name,email,token,status").eq("id",id).single();
  if(error||!data)return Response.json({error:"No se encontró a la persona."},{status:404});
  if(data.status==="cancelled")return Response.json({error:"No se puede reenviar un QR anulado."},{status:400});
  const sent=await sendQrEmail({email:data.email,firstName:data.first_name,lastName:data.last_name,token:data.token});
  if(!sent.ok)return Response.json({error:sent.error},{status:503});
  return Response.json({ok:true});
 }catch(e){return Response.json({error:safeError(e)},{status:500});}
}
