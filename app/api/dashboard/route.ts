import { authorizedApi, safeError } from "@/lib/server";
export async function GET() {
 const auth=await authorizedApi(["ADMIN"]); if("error" in auth)return auth.error;
 try {
  const {data,error}=await auth.supabase.from("participants").select("status");
  if(error)throw error;
  const rows = data as { status: string }[]; const stats={registered:rows.length,checkedIn:rows.filter((x: {status:string})=>x.status==="checked_in").length,pending:rows.filter((x: {status:string})=>x.status==="pending").length,cancelled:rows.filter((x: {status:string})=>x.status==="cancelled").length};
  return Response.json({...stats,rate:stats.registered?Math.round(stats.checkedIn/stats.registered*100):0});
 }catch(e){return Response.json({error:safeError(e)},{status:500});}
}
