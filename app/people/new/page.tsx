import { Nav } from "@/components/nav";
import { RegistrationForm } from "@/components/registration-form";
import { requireRole } from "@/lib/auth";
export default async function NewPerson(){await requireRole(["cashier"]);return <><Nav/><main className="shell narrow"><div className="pagehead"><div><span className="eyebrow">NUEVO REGISTRO</span><h1>Registrar grupo</h1><p>Cada asistente recibe una entrada con QR personal de un solo uso.</p></div></div><RegistrationForm/></main></>}
