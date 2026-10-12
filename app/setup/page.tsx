import Link from "next/link";
export default function Setup() {
 const missing=["NEXT_PUBLIC_SUPABASE_URL",...(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?[]:["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"])].filter(k=>!process.env[k]);
 return <main className="loginpage"><section className="loginbox"><Link href="/login" className="brand"><span className="brandmark">⌂</span> shikkum<span className="dot">.</span></Link><span className="eyebrow">CONFIGURACIÓN PENDIENTE</span><h1>Conecta Supabase</h1><p>Para utilizar el sistema añade estas variables en .env.local o en Vercel:</p><div className="notice error">{missing.length?missing.join(", "):"Revisa que la migración de base de datos se haya ejecutado y vuelve a cargar."}</div><p>Project URL: https://oiektdosylghnjlrcngc.supabase.co<br/>Usa la publishable key de Supabase → Project Settings → API Keys.</p></section></main>
}
