import Link from "next/link";
import { requireRole } from "@/lib/auth";
export async function Nav() {
 const {role}=await requireRole(["ADMIN","cashier","gate_operator"]);
 const canManage=role==="ADMIN"||role==="cashier";
 const links=canManage?[["/","Dashboard"],["/people","Personas"],["/people/new","Registrar"],["/scanner","Scanner"]]:[["/scanner","Scanner"]];
 return <header className="nav"><Link href="/" className="brand"><span className="brandmark">⌂</span> shikkum<span className="dot">.</span></Link><nav>{links.map(([href,label])=><Link href={href} key={href}>{label}</Link>)}</nav><div className="navuser"><span>{role==="ADMIN"?"Administrador":canManage?"Caja":"Operador"}</span><Link href="/api/auth/logout">Salir</Link></div></header>
}
