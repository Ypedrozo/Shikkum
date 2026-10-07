import Link from "next/link";
export default function Setup() {
 const missing=["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(k=>!process.env[k]);
 return <main className="loginpage"><section className="loginbox"><Link href="/login" className="brand"><span className="brandmark">⌂</span> pórtico<span className="dot">.</span></Link><span className="eyebrow">CONFIGURACIÓN PENDIENTE</span><h1>Conecta Supabase</h1><p>Para utilizar el sistema añade estas variables en .env.local o en Vercel:</p><div className="notice error">{missing.length?missing.join(", "):"Revisa que la migración de base de datos se haya ejecutado y vuelve a cargar."}</div><p>Project URL: https://geffqsydgrebjihwitsi.supabase.co<br/>La clave anon se encuentra en Supabase → Project Settings → API.</p></section></main>
}
