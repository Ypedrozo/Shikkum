import { authorize, authErrorResponse } from "../server-lib/auth.js";
import { body, json } from "../server-lib/http.js";
import { sendTicketEmail } from "../server-lib/mail.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Método no permitido." });
  try {
    const { supabase, user } = await authorize(req, ["ADMIN", "cashier"]);
    const { id } = await body(req);
    const { data: ticket, error } = await supabase.from("participants").select("*,guest_groups(responsible_name,email,phone,ticket_count)").eq("id", id).maybeSingle();
    if (error || !ticket) return json(res, 404, { error: "No se encontró la entrada." });
    if (ticket.status === "cancelled") return json(res, 409, { error: "La entrada está anulada." });
    const group = ticket.guest_groups || { responsible_name: [ticket.first_name, ticket.last_name].filter(Boolean).join(" "), email: ticket.email };
    const recipient = ticket.email || group.email;
    if (!recipient) return json(res, 400, { error: "Esta entrada no tiene un correo asignado." });
    const result = await sendTicketEmail({ req, supabase, userId: user.id, ticket, group, recipient });
    return json(res, result.status === "sent" ? 200 : 503, result.status === "sent" ? result : { ...result, error: result.message });
  } catch (error) {
    if (authErrorResponse(error, res)) return;
    return json(res, 500, { error: "No fue posible enviar el correo." });
  }
}
