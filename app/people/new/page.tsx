import { Nav } from "@/components/nav";
import { RegistrationForm } from "@/components/registration-form";
import { requireRole } from "@/lib/auth";
export default async function NewPerson(){await requireRole(["ADMIN"]);return <><Nav/><main className="shell narrow"><div className="pagehead"><div><span className="eyebrow">NUEVO REGISTRO</span><h1>Registrar persona</h1><p>Se guardará en Supabase y se generará su QR de un solo uso.</p></div></div><RegistrationForm/></main></>}
