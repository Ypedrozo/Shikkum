import { randomBytes } from "node:crypto";
import { authorizedApi, safeError, sendQrEmail } from "@/lib/server";

export async function GET(request: Request) {
  const auth = await authorizedApi(["ADMIN"]);
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status") ?? "all";
    let query = auth.supabase.from("participants").select("id,first_name,last_name,email,identification,phone,status,token,created_at,checked_in_at").order("created_at", { ascending: false }).limit(500);
    if (status !== "all") query = query.eq("status", status);
    if (q) query = query.or(["first_name","last_name","email","identification"].map(k=>`${k}.ilike.%${q.replace(/[,%()]/g,"")}%`).join(","));
    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ participants: data });
  } catch (e) { return Response.json({ error: safeError(e) }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await authorizedApi(["ADMIN"]);
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json();
    const fields = ["firstName","lastName","email","identification","phone"] as const;
    for (const k of fields) if (typeof body[k] !== "string" || !body[k].trim()) return Response.json({ error: "Completa todos los campos." }, { status: 400 });
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Ingresa un correo válido." }, { status: 400 });
    const token = randomBytes(32).toString("base64url");
    const person = { first_name: body.firstName.trim(), last_name: body.lastName.trim(), email,
      identification: body.identification.trim(), phone: body.phone.trim(), token, registered_by: auth.user.id };
    const { data, error } = await auth.supabase.from("participants").insert(person).select("id,first_name,last_name,email,identification,phone,status,token,created_at,checked_in_at").single();
    if (error?.code === "23505") return Response.json({ error: "Esta persona ya está registrada (correo o identificación duplicados)." }, { status: 409 });
    if (error) throw error;
    const emailResult = await sendQrEmail({ email, firstName: person.first_name, lastName: person.last_name, token });
    return Response.json({ participant: data, email: emailResult.ok ? "sent" : "failed", emailMessage: emailResult.ok ? null : emailResult.error }, { status: 201 });
  } catch (e) { return Response.json({ error: safeError(e) }, { status: 500 }); }
}
