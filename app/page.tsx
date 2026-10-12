import Link from "next/link";
import { Nav } from "@/components/nav";
import { requireRole } from "@/lib/auth";
export default async function Home() {
 const {role,supabase}=await requireRole(["ADMIN","cashier","gate_operator"]);
 if(role==="SCANNER"||role==="gate_operator") return <><Nav/><main className="shell"><section className="welcome"><span className="eyebrow">CONTROL DE ACCESO</span><h1>Scanner listo</h1><p>Escanea la credencial de cada participante para validar su ingreso.</p><Link className="button primary" href="/scanner">Abrir scanner de cámara →</Link></section></main></>;
 const statuses=["pending","checked_in","cancelled"] as const;
 const counts=await Promise.all(statuses.map(status=>supabase.from("participants").select("id",{count:"exact",head:true}).eq("status",status)));
 const error=counts.find(result=>result.error)?.error;
 const stats=error?null:{registered:counts.reduce((sum,result)=>sum+(result.count??0),0),checked:counts[1].count??0,pending:counts[0].count??0,cancelled:counts[2].count??0};
 return <><Nav/><main className="shell"><div className="pagehead"><div><span className="eyebrow">PANEL DE CONTROL</span><h1>Dashboard</h1><p>Resumen actualizado desde la base de datos.</p></div><div className="actions"><Link className="button primary" href="/people/new">＋ Registrar persona</Link><Link className="button secondary" href="/scanner">▣ Escanear QR</Link></div></div>
 {error?<div className="notice error">No fue posible cargar los datos. Ejecuta la migración de Supabase y configura las variables de conexión.</div>:<><section className="metrics">{[["Registrados",stats!.registered],["Ingresados",stats!.checked],["Pendientes",stats!.pending],["Anulados",stats!.cancelled]].map(([label,n])=><article className="metric" key={label}><span>{label}</span><strong>{n}</strong><small>Personas</small></article>)}</section><section className="attendance"><div><span className="eyebrow">ASISTENCIA</span><h2>{stats!.registered?Math.round(stats!.checked/stats!.registered*100):0}%</h2><p>{stats!.checked} de {stats!.registered} participantes ingresaron</p></div><div className="progress"><span style={{width:`${stats!.registered?stats!.checked/stats!.registered*100:0}%`}}/></div></section></>}
 <section className="quicklinks"><Link href="/people"><strong>Personas →</strong><span>Buscar y gestionar registros</span></Link><Link href="/people/new"><strong>Registrar →</strong><span>Crear una credencial QR</span></Link><Link href="/scanner"><strong>Scanner →</strong><span>Validar entradas con cámara</span></Link></section></main></>;
}
