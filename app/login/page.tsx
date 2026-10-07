import Link from "next/link";
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const {error}=await searchParams;
 return <main className="loginpage"><section className="loginbox"><Link href="/" className="brand"><span className="brandmark">⌂</span> pórtico<span className="dot">.</span></Link><span className="eyebrow">CONTROL DE ACCESO</span><h1>Iniciar sesión</h1><p>Accede para gestionar registros o validar entradas.</p>{error&&<div className="notice error">Correo o contraseña incorrectos.</div>}<form action="/api/auth" method="post" className="loginform"><label>Correo<input name="email" type="email" required autoComplete="username"/></label><label>Contraseña<input name="password" type="password" required autoComplete="current-password"/></label><button className="button primary full">Entrar</button></form><p className="hint">Las cuentas se administran desde Supabase Auth.</p></section></main>
}
