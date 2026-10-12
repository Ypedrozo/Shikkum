import { authorizedApi, safeError } from "@/lib/server";
export async function GET() {
  const auth = await authorizedApi(["cashier"]); if ("error" in auth) return auth.error;
  try {
    const statuses = ["pending", "checked_in", "cancelled"] as const;
    const counts = await Promise.all(statuses.map((status) => auth.supabase.from("participants").select("id", { count: "exact", head: true }).eq("status", status)));
    const failed = counts.find((entry) => entry.error)?.error; if (failed) throw failed;
    const registered = counts.reduce((sum, entry) => sum + (entry.count ?? 0), 0), checkedIn = counts[1].count ?? 0;
    return Response.json({ registered, checkedIn, pending: counts[0].count ?? 0, cancelled: counts[2].count ?? 0, rate: registered ? Math.round(checkedIn / registered * 100) : 0 });
  } catch (error) { return Response.json({ error: safeError(error) }, { status: 500 }); }
}
