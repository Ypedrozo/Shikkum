import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import QRCode from "qrcode";
import { canAccess, type Role } from "@/lib/auth";

export async function authorizedApi(roles: Role[] = ["cashier"]) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return { error: Response.json({ error: "Falta configurar Supabase." }, { status: 503 }) };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Inicia sesión para continuar." }, { status: 401 }) };
  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role as Role | undefined;
  if (!role || !canAccess(role, roles)) return { error: Response.json({ error: "No tienes permisos para esta acción." }, { status: 403 }) };
  return { supabase, user, role };
}
export function safeError(error: unknown) {
  console.error(error);
  return "No fue posible conectarse con el servidor. Intenta nuevamente.";
}
export function envEmailError() {
  const missing = ["RESEND_API_KEY", "RESEND_FROM_EMAIL"].filter((key) => !process.env[key]);
  return missing.length ? `Falta configuración de correo: ${missing.join(", ")}.` : null;
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
export async function sendQrEmail(input: {
  email: string; firstName: string; lastName?: string | null; token: string;
  ticketNumber?: number | null; ticketCount?: number; publicUrl?: string;
}) {
  const missing = envEmailError();
  if (missing) return { ok: false as const, error: missing, providerId: null };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const png = await QRCode.toBuffer(input.token, { width: 360, margin: 2 });
    const event = process.env.EVENT_NAME ? `<p>Evento: ${escapeHtml(process.env.EVENT_NAME)}</p>` : "";
    const number = input.ticketNumber ? `<p>Entrada ${input.ticketNumber}${input.ticketCount ? ` de ${input.ticketCount}` : ""}</p>` : "";
    const link = input.publicUrl ? `<p><a href="${escapeHtml(input.publicUrl)}">Ver y descargar entrada</a></p>` : "";
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!, to: input.email,
      subject: process.env.EVENT_NAME ? `Tu entrada para ${process.env.EVENT_NAME}` : "Tu entrada QR de Shikkum",
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#182522"><h1>Hola, ${escapeHtml(input.firstName)} ${escapeHtml(input.lastName ?? "")}</h1>${event}${number}<p>Presenta este código QR al llegar. Es personal y de un solo uso.</p><img alt="Tu código QR de acceso" src="cid:access-qr" width="300" height="300"/>${link}<p>No compartas este código con otras personas.</p></div>`,
      attachments: [{ filename: "entrada-qr.png", content: png.toString("base64"), contentType: "image/png", contentId: "access-qr" }],
    });
    if (result.error) return { ok: false as const, error: "Resend no pudo enviar el correo. Verifica el remitente y la configuración.", providerId: null };
    return { ok: true as const, error: null, providerId: result.data?.id ?? null };
  } catch {
    return { ok: false as const, error: "No fue posible conectarse con el servicio de correo.", providerId: null };
  }
}
