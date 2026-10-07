import { Nav } from "@/components/nav";
import { Scanner } from "@/components/scanner";
import { requireRole } from "@/lib/auth";
export default async function ScannerPage(){await requireRole(["ADMIN","SCANNER"]);return <><Nav/><main className="shell narrow"><div className="pagehead"><div><span className="eyebrow">VALIDACIÓN DE ACCESO</span><h1>Scanner QR</h1><p>Escanea el código personal del participante.</p></div></div><Scanner/></main></>}
