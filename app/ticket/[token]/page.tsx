import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_ticket", { p_token: token });
  const ticket = data as { first_name: string|null; last_name:string|null; ticket_number:number|null; ticket_count:number|null; group_name:string|null; status:string; created_at:string; checked_in_at:string|null } | null;
  if (!ticket) return <main className="ticketpage"><section className="ticketcard"><h1>Entrada no encontrada</h1><p>Este enlace no corresponde a una entrada válida.</p></section></main>;
  const qr = await QRCode.toDataURL(token, { width: 420, margin: 2 });
  const name = [ticket.first_name, ticket.last_name].filter(Boolean).join(" ") || "Invitado por asignar";
  const states:Record<string,string> = { pending:"Válida · pendiente de ingreso", checked_in:"Ya utilizada", cancelled:"Anulada" };
  return <main className="ticketpage"><section className="ticketcard"><span className="eyebrow">SHIKKUM · ENTRADA PERSONAL</span><h1>{name}</h1><p>{ticket.group_name ? `Grupo: ${ticket.group_name} · ` : ""}Entrada {ticket.ticket_number ?? "—"}{ticket.ticket_count ? ` de ${ticket.ticket_count}` : ""}</p><img className="qrimage" src={qr} alt="Código QR de acceso"/><p className={`badge ${ticket.status}`}>{states[ticket.status] ?? "Estado desconocido"}</p><p>Presenta este QR en el acceso. Es personal y de un solo uso.</p>{ticket.status === "checked_in" && ticket.checked_in_at && <p>Ingreso registrado: {new Date(ticket.checked_in_at).toLocaleString("es-EC")}</p>}<a className="button primary" href={qr} download={`shikkum-entrada-${ticket.ticket_number ?? "qr"}.png`}>Descargar QR</a><PrintButton/></section></main>;
}
