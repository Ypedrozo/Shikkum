import { authorizedApi, safeError } from "@/lib/server";
export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizedApi(["cashier"]); if ("error" in auth) return auth.error;
  try {
    const { id } = await context.params;
    const { data, error } = await auth.supabase.rpc("cancel_ticket", { p_id: id });
    if (error) throw error;
    if (!data?.ok) return Response.json({ error: "No se puede anular una entrada ya utilizada o anulada." }, { status: 409 });
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: safeError(error) }, { status: 500 }); }
}
