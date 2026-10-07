import Link from "next/link";
import { Nav } from "@/components/nav";
import { PeopleTable } from "@/components/people-table";
import { requireRole } from "@/lib/auth";
export default async function People({searchParams}:{searchParams:Promise<{show?:string}>}){await requireRole(["ADMIN"]);const params=await searchParams;return <><Nav/><main className="shell"><div className="pagehead"><div><span className="eyebrow">DIRECTORIO</span><h1>Personas</h1><p>Registros conectados a Supabase.</p></div><Link className="button primary" href="/people/new">＋ Registrar persona</Link></div><PeopleTable initialShow={params.show}/></main></>}
