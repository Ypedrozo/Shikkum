import { createClient } from "@supabase/supabase-js";
import { json } from "../server-lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Método no permitido." });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return json(res, 503, { error: "Servicio no configurado." });
  const token = new URL(req.url, "http://localhost").searchParams.get("token");
  if (!token || token.length > 100) return json(res, 400, { error: "El QR no existe." });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("get_public_ticket", { p_token: token });
  if (error) return json(res, 503, { error: "No fue posible consultar la entrada." });
  if (!data) return json(res, 404, { error: "El QR no existe." });
  return json(res, 200, data);
}
