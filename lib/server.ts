import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import QRCode from "qrcode";

export async function authorizedApi(roles:("ADMIN"|"SCANNER")[]=["ADMIN"]) {
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)return {error:Response.json({error:"Falta configurar NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY."},{status:503})};
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return {error:Response.json({error:"Inicia sesión para continuar."},{status:401})};
 const {data:profile}=await supabase.from("user_profiles").select("role").eq("id",user.id).maybeSingle();
 if(!profile||!roles.includes(profile.role))return {error:Response.json({error:"No tienes permisos para esta acción."},{status:403})};
 return {supabase,user,role:profile.role as "ADMIN"|"SCANNER"};
}
export function safeError(error:unknown){console.error(error);return "No fue posible conectarse con el servidor. Intenta nuevamente."}
export function envEmailError(){const missing=["RESEND_API_KEY","RESEND_FROM_EMAIL"].filter(k=>!process.env[k]);return missing.length?`Falta configuración de correo: ${missing.join(", ")}.`:null}
export async function sendQrEmail(input:{email:string;firstName:string;lastName:string;token:string}) {
 const missing=envEmailError();if(missing)return {ok:false as const,error:missing};
 const resend=new Resend(process.env.RESEND_API_KEY);
 const png=await QRCode.toBuffer(input.token,{width:360,margin:2});
 const event=process.env.EVENT_NAME?'<p>Evento: '+escapeHtml(process.env.EVENT_NAME)+'</p>':"";
 const result=await resend.emails.send({from:process.env.RESEND_FROM_EMAIL!,to:input.email,subject:"Tu credencial de acceso",html:`<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#182522"><h1>Hola, ${escapeHtml(input.firstName)} ${escapeHtml(input.lastName)}</h1>${event}<p>Presenta este código QR al llegar. Es personal y de un solo uso.</p><img alt="Tu código QR de acceso" src="cid:access-qr" width="300" height="300"/><p>No compartas este código. El equipo de acceso lo validará al ingreso.</p></div>`,attachments:[{filename:"credencial-qr.png",content:png.toString("base64"),contentType:"image/png",contentId:"access-qr"}]});
 if(result.error)return {ok:false as const,error:"No fue posible enviar el correo. Verifica la configuración de Resend y el remitente."};
 return {ok:true as const};
}
function escapeHtml(s:string){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!))}
