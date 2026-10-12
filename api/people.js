import { authorize, authErrorResponse } from "../server-lib/auth.js";
import { body, json, safeError } from "../server-lib/http.js";

const staff = ["ADMIN", "cashier"];

export default async function handler(req, res) {
  try {
    const { supabase, user } = await authorize(req, staff);
    if (req.method === "GET") {
      const { data, error } = await supabase.from("participants")
        .select("*,guest_groups(id,responsible_name,email,phone,ticket_count),email_delivery_logs(id,recipient,requested_at,status,provider_id,error_message)")
        .order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return json(res, 200, { people: data || [] });
    }
    if (req.method !== "POST") return json(res, 405, { error: "Método no permitido." });
    const input = await body(req);
    const responsibleName = String(input.responsible_name || "").trim();
    const email = String(input.email || "").trim().toLowerCase();
    const phone = String(input.phone || "").trim();
    const tickets = Array.isArray(input.tickets) ? input.tickets : [];
    if (responsibleName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[+()0-9 .-]{5,30}$/.test(phone) || tickets.length < 1 || tickets.length > 20) {
      return json(res, 400, { error: "Revisa el nombre, email, teléfono y número de entradas." });
    }
    const normalized = tickets.map((ticket) => ({
      first_name: String(ticket.first_name || "").trim() || null,
      last_name: String(ticket.last_name || "").trim() || null,
      email: String(ticket.email || "").trim().toLowerCase() || null,
      phone: String(ticket.phone || "").trim() || null,
      identification: String(ticket.identification || "").trim() || null,
    }));
    const { data, error } = await supabase.rpc("register_guest_group", {
      p_responsible_name: responsibleName,
      p_email: email,
      p_phone: phone,
      p_ticket_count: normalized.length,
      p_tickets: normalized,
    });
    if (error) throw error;
    const { sendTicketEmail } = await import("../server-lib/mail.js");
    const results = await Promise.all((data.tickets || []).map(async (ticket) => {
      const recipient = ticket.email || (ticket.is_placeholder ? null : email);
      if (!recipient) return { id: ticket.id, status: "skipped", message: "Entrada pendiente de asignar." };
      const sent = await sendTicketEmail({ req, supabase, userId: user.id, ticket, group: data.group, recipient });
      return { id: ticket.id, ...sent };
    }));
    return json(res, 201, { ...data, emailResults: results });
  } catch (error) {
    if (authErrorResponse(error, res)) return;
    return json(res, 400, { error: safeError(error) });
  }
}
