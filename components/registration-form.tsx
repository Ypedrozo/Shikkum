"use client";
import { useState } from "react";
export function RegistrationForm() {
 const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [result,setResult]=useState<any>(null);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError(""); const f=new FormData(e.currentTarget);
 try{const r=await fetch("/api/people",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({firstName:f.get("firstName"),lastName:f.get("lastName"),email:f.get("email"),identification:f.get("identification"),phone:f.get("phone")})}); const d=await r.json();if(!r.ok)throw Error(d.error);setResult(d);e.currentTarget.reset();}catch(x){setError(x instanceof Error?x.message:"No fue posible conectarse con el servidor.");}finally{setBusy(false)}}
 if(result)return <div className="successbox"><h2>✓ Persona registrada</h2><p>{result.participant.first_name} {result.participant.last_name}</p><p>QR generado correctamente. <a href={`/people?show=${result.participant.id}`}>Ver QR</a></p><p>Email: {result.email==="sent"?"Enviado correctamente":result.emailMessage}</p><a className="button secondary" href="/people/new">Registrar otra persona</a></div>;
 return <form className="formcard" onSubmit={submit}><div className="formgrid">{[["firstName","Nombres","text"],["lastName","Apellidos","text"],["email","Email","email"],["identification","Identificación","text"],["phone","Teléfono","tel"]].map(([name,label,type])=><label key={name}>{label}<input required name={name} type={type} autoComplete={name==="email"?"email":"off"} /></label>)}</div>{error&&<p className="notice error">{error}</p>}<button className="button primary" disabled={busy}>{busy?"Guardando…":"Registrar y enviar QR"}</button></form>;
}
