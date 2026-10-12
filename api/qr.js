import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { origin } from "../server-lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") { res.statusCode = 405; return res.end("Method not allowed"); }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = new URL(req.url, "http://localhost").searchParams.get("token");
  if (!url || !key || !token || token.length > 100) { res.statusCode = 404; return res.end("QR not found"); }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await supabase.rpc("get_public_ticket", { p_token: token });
  if (!data) { res.statusCode = 404; return res.end("QR not found"); }
  const target = `${origin(req)}/ticket.html?token=${encodeURIComponent(token)}`;
  const png = await QRCode.toBuffer(target, { type: "png", width: 360, margin: 1, errorCorrectionLevel: "H" });
  res.statusCode = 200;
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "private, max-age=60");
  res.end(png);
}
