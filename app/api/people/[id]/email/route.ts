import { authorizedApi, safeError, sendQrEmail } from "@/lib/server";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizedApi(["cashier"]); if ("error" in auth) return auth.error;
  try {
    const { id } = await context.params;
    const { data, error } = await auth.supabase.from("participants").select("id,first_name,last_name,email,token,status,ticket_number,group_id").eq("id", id).single();
    if (error || !data) return Response.json({ error: "No se encontró la entrada." }, { status: 404 });
    if (data.status === "cancelled") return Response.json({ error: "No se puede reenviar un QR anulado." }, { status: 400 });
    let recipient = data.email;
    let ticketCount = 1;
    if (data.group_id) {
      const { data: group, error: groupError } = await auth.supabase.from("guest_groups").select("email,ticket_count").eq("id", data.group_id).single();
      if (groupError || !group) throw groupError ?? new Error("No se encontró el grupo de esta entrada.");
      recipient = recipient || group.email; ticketCount = group.ticket_count;
    }
    if (!recipient) return Response.json({ error: "La entrada no tiene un correo de destino." }, { status: 400 });
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL?.replace(/^/, "https://") || new URL(request.url).origin).replace(/\/$/, "");
    const sent = await sendQrEmail({ email: recipient, firstName: data.first_name ?? "Invitado", lastName: data.last_name, token: data.token, ticketNumber: data.ticket_number, ticketCount, publicUrl: `${origin}/ticket/${data.token}` });
    const { error: logError } = await auth.supabase.from("email_delivery_logs").insert({ participant_id: data.id, recipient, status: sent.ok ? "sent" : "failed", provider_id: sent.providerId, error_message: sent.error });
    if (logError) throw logError;
    if (!sent.ok) return Response.json({ error: sent.error }, { status: 503 });
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: safeError(error) }, { status: 500 }); }
}
