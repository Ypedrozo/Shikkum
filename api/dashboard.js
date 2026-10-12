import { authorize, authErrorResponse } from "../server-lib/auth.js";
import { json } from "../server-lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Método no permitido." });
  try {
    const { supabase } = await authorize(req, ["ADMIN", "cashier"]);
    const statuses = ["pending", "checked_in", "cancelled"];
    const [all, ...counts] = await Promise.all([
      supabase.from("participants").select("id", { count: "exact", head: true }),
      ...statuses.map((status) => supabase.from("participants").select("id", { count: "exact", head: true }).eq("status", status)),
    ]);
    if (all.error || counts.some((item) => item.error)) throw new Error("database_unavailable");
    const total = all.count || 0;
    const [pending, checkedIn, cancelled] = counts.map((item) => item.count || 0);
    return json(res, 200, { total, pending, checkedIn, cancelled, attendancePercent: total ? Math.round((checkedIn / total) * 100) : 0 });
  } catch (error) {
    if (authErrorResponse(error, res)) return;
    return json(res, 500, { error: "No fue posible consultar el resumen." });
  }
}
