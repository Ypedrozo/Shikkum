"use client";
import { useState } from "react";

type Ticket = { id: string; first_name: string | null; last_name: string | null; email: string | null; token: string; ticket_number: number; is_placeholder: boolean; emailStatus: "sent" | "failed"; emailMessage?: string | null };
type Registration = { group: { responsible_name: string; ticket_count: number; email: string }; tickets: Ticket[] };

export function RegistrationForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Registration | null>(null);
  const [count, setCount] = useState(1);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const attendees = Array.from({ length: count }, (_, index) => ({
      fullName: String(form.get(`name-${index + 1}`) ?? ""),
      email: String(form.get(`email-${index + 1}`) ?? ""),
      phone: String(form.get(`phone-${index + 1}`) ?? ""),
      identification: String(form.get(`identification-${index + 1}`) ?? ""),
    }));
    try {
      const response = await fetch("/api/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responsibleName: form.get("responsibleName"), email: form.get("email"), phone: form.get("phone"), ticketCount: count, attendees }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No fue posible registrar el grupo.");
      setResult(data); event.currentTarget.reset(); setCount(1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible conectarse con el servidor."); }
    finally { setBusy(false); }
  }

  if (result) return <section className="successbox"><h2>✓ Registro completado</h2><p><strong>{result.group.responsible_name}</strong> · {result.tickets.length} {result.tickets.length === 1 ? "entrada" : "entradas"}</p><p>Responsable: <a href={`mailto:${result.group.email}`}>{result.group.email}</a></p>
    <div className="ticketresults">{result.tickets.map((ticket) => <article className="ticketresult" key={ticket.id}><strong>Entrada {ticket.ticket_number}</strong><span>{ticket.is_placeholder ? "Invitado por asignar" : `${ticket.first_name ?? ""} ${ticket.last_name ?? ""}`}</span><span>{ticket.emailStatus === "sent" ? `Correo enviado a ${ticket.email ?? result.group.email}` : `No se envió el correo: ${ticket.emailMessage ?? "revisa la configuración de Resend"}`}</span><div className="rowactions"><a href={`/ticket/${ticket.token}`} target="_blank" rel="noreferrer">Ver QR</a><a href={`https://wa.me/?text=${encodeURIComponent(`Tu entrada QR de Shikkum: ${typeof window === "undefined" ? "" : window.location.origin}/ticket/${ticket.token}`)}`} target="_blank" rel="noreferrer">Compartir por WhatsApp</a></div></article>)}</div>
    <a className="button secondary" href="/people/new">Registrar otro grupo</a></section>;

  return <form className="formcard" onSubmit={submit}><h2>Responsable del grupo</h2><div className="formgrid"><label>Nombre completo<input required name="responsibleName" minLength={2} maxLength={160} autoComplete="name"/></label><label>Email del responsable<input required name="email" type="email" maxLength={254} autoComplete="email"/></label><label>Teléfono<input required name="phone" type="tel" minLength={5} maxLength={30} autoComplete="tel"/></label><label>Número de entradas<select value={count} onChange={(event) => setCount(Number(event.target.value))}>{Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label></div>
    <h2>Personas invitadas</h2><p className="muted">La primera entrada se asigna al responsable si dejas el nombre vacío. Puedes dejar otras entradas como invitado por asignar.</p><div className="attendeeforms">{Array.from({ length: count }, (_, index) => <fieldset key={index}><legend>Entrada {index + 1}{index === 0 ? " · Responsable" : ""}</legend><div className="formgrid"><label>Nombre y apellidos<input name={`name-${index + 1}`} maxLength={160} placeholder={index === 0 ? "Se usará el nombre del responsable" : "Opcional"}/></label><label>Email del asistente<input name={`email-${index + 1}`} type="email" maxLength={254} placeholder={index === 0 ? "Se usará el email del responsable" : "Opcional"}/></label><label>Teléfono<input name={`phone-${index + 1}`} type="tel" maxLength={30}/></label><label>Identificación<input name={`identification-${index + 1}`} maxLength={50}/></label></div></fieldset>)}</div>
    {error && <p className="notice error">{error}</p>}<button className="button primary" disabled={busy}>{busy ? "Registrando…" : "Registrar grupo y generar QR"}</button></form>;
}
