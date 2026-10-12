import { json } from "../server-lib/http.js";

export default function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Método no permitido." });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return json(res, 503, { error: "Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." });
  return json(res, 200, { url, key, eventName: process.env.EVENT_NAME || "Evento Shikkum" });
}
