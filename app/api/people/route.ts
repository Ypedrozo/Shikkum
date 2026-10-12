import { authorizedApi, safeError, sendQrEmail } from "@/lib/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+()\d\s.-]{5,30}$/;

export async function GET(request: Request) {
  const auth = await authorizedApi(["cashier"]);
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().replace(/[,%()]/g, "");
    const status = url.searchParams.get("status") ?? "all";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = 50;
    let query = auth.supabase.from("participants")
      .select("id,first_name,last_name,email,identification,phone,status,token,created_at,checked_in_at,group_id,ticket_number,is_placeholder,cancelled_at", { count: "exact" })
      .order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (["pending", "checked_in", "cancelled"].includes(status)) query = query.eq("status", status);
    if (q) query = query.or(["first_name", "last_name", "email", "identification", "phone"].map((key) => `${key}.ilike.%${q}%`).join(","));
    const { data, error, count } = await query;
    if (error) throw error;
    const tickets = data ?? [];
    const groupIds = [...new Set(tickets.map((ticket) => ticket.group_id).filter(Boolean))] as string[];
    const [groupsResult, logsResult] = await Promise.all([
      groupIds.length
        ? auth.supabase.from("guest_groups").select("id,responsible_name,email,phone,ticket_count,created_at").in("id", groupIds)
        : Promise.resolve({ data: [], error: null }),
      tickets.length
        ? auth.supabase.from("email_delivery_logs").select("participant_id,status,recipient,requested_at,error_message,provider_id").in("participant_id", tickets.map((ticket) => ticket.id)).order("requested_at", { ascending: false }).limit(250)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (groupsResult.error) throw groupsResult.error;
    if (logsResult.error) throw logsResult.error;
    const groups = Object.fromEntries((groupsResult.data ?? []).map((group) => [group.id, group]));
    const latestEmail: Record<string, unknown> = {};
    for (const log of logsResult.data ?? []) if (!latestEmail[log.participant_id]) latestEmail[log.participant_id] = log;
    return Response.json({ tickets, groups, latestEmail, total: count ?? 0, page, pageSize, hasMore: page * pageSize < (count ?? 0) });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizedApi(["cashier"]);
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json();
    const name = typeof body.responsibleName === "string" ? body.responsibleName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const ticketCount = Number(body.ticketCount);
    if (name.length < 2 || name.length > 160) return Response.json({ error: "Ingresa un nombre de responsable de 2 a 160 caracteres." }, { status: 400 });
    if (!emailPattern.test(email) || email.length > 254) return Response.json({ error: "Ingresa un correo válido." }, { status: 400 });
    if (!phonePattern.test(phone)) return Response.json({ error: "Ingresa un teléfono válido." }, { status: 400 });
    if (!Number.isInteger(ticketCount) || ticketCount < 1 || ticketCount > 20) return Response.json({ error: "La cantidad debe ser de 1 a 20 entradas." }, { status: 400 });
    const rawAttendees = Array.isArray(body.attendees) ? body.attendees : [];
    if (rawAttendees.length > ticketCount) return Response.json({ error: "Hay más asistentes que entradas." }, { status: 400 });
    const attendees = Array.from({ length: ticketCount }, (_, index) => {
      const attendee = rawAttendees[index] ?? {};
      const fullName = typeof attendee.fullName === "string" ? attendee.fullName.trim() : "";
      const parts = fullName.split(/\s+/).filter(Boolean);
      const attendeeEmail = typeof attendee.email === "string" ? attendee.email.trim().toLowerCase() : "";
      const attendeePhone = typeof attendee.phone === "string" ? attendee.phone.trim() : "";
      const identification = typeof attendee.identification === "string" ? attendee.identification.trim() : "";
      if (fullName.length > 160 || attendeeEmail.length > 254 || attendeePhone.length > 30 || identification.length > 50) {
        throw new Error("Revisa la longitud de los datos de cada asistente.");
      }
      if (attendeeEmail && !emailPattern.test(attendeeEmail)) throw new Error("Hay un correo de asistente no válido.");
      if (attendeePhone && !phonePattern.test(attendeePhone)) throw new Error("Hay un teléfono de asistente no válido.");
      if (fullName && parts[0].length > 100) throw new Error("El nombre de un asistente es demasiado largo.");
      return {
        first_name: parts[0] ?? null,
        last_name: parts.slice(1).join(" ") || null,
        email: attendeeEmail || null,
        phone: attendeePhone || null,
        identification: identification || null,
      };
    });
    const { data, error } = await auth.supabase.rpc("register_guest_group", {
      p_responsible_name: name, p_email: email, p_phone: phone,
      p_ticket_count: ticketCount, p_tickets: attendees,
    });
    if (error?.code === "23505") return Response.json({ error: "La identificación de uno de los asistentes ya está registrada." }, { status: 409 });
    if (error?.code === "22023") return Response.json({ error: "Revisa los datos de los asistentes y vuelve a intentarlo." }, { status: 400 });
    if (error) throw error;
    const registration = data as { group: { id: string; email: string; responsible_name: string; ticket_count: number }; tickets: Array<Record<string, unknown>> };
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL?.replace(/^/, "https://") || new URL(request.url).origin).replace(/\/$/, "");
    const deliveries: Array<Record<string, unknown>> = [];
    for (let offset = 0; offset < registration.tickets.length; offset += 5) {
      const batch = registration.tickets.slice(offset, offset + 5);
      const batchResults = await Promise.all(batch.map(async (ticket) => {
        const recipient = typeof ticket.email === "string" ? ticket.email : registration.group.email;
        const firstName = typeof ticket.first_name === "string" ? ticket.first_name : "Invitado";
        const lastName = typeof ticket.last_name === "string" ? ticket.last_name : "";
        const token = String(ticket.token);
        const result = await sendQrEmail({
          email: recipient, firstName, lastName, token,
          ticketNumber: Number(ticket.ticket_number), ticketCount: registration.group.ticket_count,
          publicUrl: `${origin}/ticket/${token}`,
        });
        const log = await auth.supabase.from("email_delivery_logs").insert({
          participant_id: ticket.id, recipient, status: result.ok ? "sent" : "failed",
          provider_id: result.providerId, error_message: result.error,
        });
        return { ...ticket, emailStatus: result.ok ? "sent" : "failed",
          emailMessage: log.error ? "No se pudo guardar el historial de entrega." : result.error,
          providerId: result.providerId };
      }));
      deliveries.push(...batchResults);
    }
    return Response.json({ group: registration.group, tickets: deliveries }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && !("code" in error)) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: safeError(error) }, { status: 500 });
  }
}
