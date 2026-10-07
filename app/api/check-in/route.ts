import { authorizedApi, safeError } from "@/lib/server";
export async function POST(request: Request) {
 const auth=await authorizedApi(["ADMIN","SCANNER"]); if("error" in auth)return auth.error;
 try {
  const {token,deviceInfo}=await request.json();
  if(typeof token!=="string"||!token.trim())return Response.json({error:"El QR no contiene un código válido."},{status:400});
  const {data,error}=await auth.supabase.rpc("check_in_qr",{p_token:token.trim(),p_device_info:typeof deviceInfo==="string"?deviceInfo.slice(0,250):null});
  if(error)throw error;
  return Response.json(data);
 }catch(e){return Response.json({error:safeError(e)},{status:500});}
}
