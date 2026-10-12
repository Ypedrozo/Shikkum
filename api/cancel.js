import { authorize, authErrorResponse } from "../server-lib/auth.js";
import { body, json } from "../server-lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Método no permitido." });
  try {
    const { supabase } = await authorize(req, ["ADMIN", "cashier"]);
    const { id } = await body(req);
    const { data, error } = await supabase.rpc("cancel_ticket", { p_id: id });
    if (error) throw error;
    return json(res, data.ok ? 200 : 409, { ok: !!data.ok, error: data.ok ? null : "La entrada ya fue utilizada o anulada." });
  } catch (error) {
    if (authErrorResponse(error, res)) return;
    return json(res, 400, { error: "No fue posible anular la entrada." });
  }
}
