import { authorize, authErrorResponse } from "../server-lib/auth.js";
import { body, json } from "../server-lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Método no permitido." });
  try {
    const { supabase } = await authorize(req, ["ADMIN", "SCANNER", "gate_operator"]);
    const input = await body(req);
    const token = String(input.token || "").trim();
    if (!token || token.length > 200) return json(res, 400, { result: "invalid", error: "El QR no es válido." });
    const { data, error } = await supabase.rpc("check_in_qr", { p_token: token, p_device_info: String(input.device_info || "").slice(0, 250) });
    if (error) throw error;
    return json(res, 200, data);
  } catch (error) {
    if (authErrorResponse(error, res)) return;
    return json(res, 500, { error: "No fue posible validar el QR." });
  }
}
