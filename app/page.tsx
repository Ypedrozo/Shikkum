const items = [
  ["01", "Registro claro", "Cada persona queda vinculada a un evento y a una credencial digital única."],
  ["02", "Ingreso de un solo uso", "Validación centralizada para evitar ingresos duplicados, incluso con varios operadores."],
  ["03", "Control en tiempo real", "Una base para consultar asistencia, pendientes e historial."],
];

export default function Home() {
  return <main className="min-h-screen overflow-hidden">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
      <a className="flex items-center gap-3 font-bold tracking-tight" href="#inicio"><span className="grid size-10 place-items-center rounded-xl bg-[#174f42] text-xl text-[#d9f36b]">⌂</span><span className="text-lg">pórtico<span className="text-[#5d746b]">.</span></span></a>
      <span className="hidden rounded-full border border-[#dce2dc] px-4 py-2 text-xs font-semibold tracking-wide text-[#52635c] sm:inline-flex">PLATAFORMA DE ACCESOS</span>
      <a className="rounded-full bg-[#174f42] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#103d33]" href="#plataforma">Explorar plataforma ↗</a>
    </header>
    <section id="inicio" className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-12 lg:grid-cols-[1.02fr_.98fr] lg:px-10 lg:pb-28 lg:pt-20">
      <div className="relative z-10">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dce2dc] bg-white/70 px-3 py-2 text-xs font-semibold text-[#456057]"><span className="size-2 rounded-full bg-[#8dbb3f]" /> REGISTRO · CREDENCIALES · INGRESO</div>
        <h1 className="max-w-2xl text-5xl font-semibold leading-[1.04] tracking-[-.055em] sm:text-6xl lg:text-[4.55rem]">La entrada fluye.<br/><span className="text-[#658176]">El control también.</span></h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-[#697773]">Una experiencia sencilla para registrar participantes, emitir sus códigos QR y validar cada ingreso en tiempo real.</p>
        <div className="mt-9 flex flex-wrap items-center gap-4"><a href="#plataforma" className="rounded-full bg-[#174f42] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-[#174f42]/10 transition hover:-translate-y-0.5">Conocer el sistema →</a><span className="text-sm text-[#718079]">Diseñado para equipos en movimiento</span></div>
        <div className="mt-14 flex gap-10 border-t border-[#dce2dc] pt-6">{[["1 QR", "por participante"], ["1 uso", "por credencial"], ["En vivo", "validación central"]].map(([v, l]) => <div key={v}><p className="text-2xl font-semibold tracking-tight">{v}</p><p className="mt-1 text-xs text-[#718079]">{l}</p></div>)}</div>
      </div>
      <div className="relative mx-auto w-full max-w-[550px]">
        <div className="absolute -right-12 -top-16 size-72 rounded-full bg-[#e6edcf] blur-3xl"/><div className="absolute -bottom-16 -left-12 size-64 rounded-full bg-[#d9e8df] blur-3xl"/>
        <div className="relative rounded-[2rem] border border-white bg-white/70 p-4 shadow-[0_28px_90px_-45px_rgba(29,63,50,.35)] backdrop-blur"><div className="overflow-hidden rounded-[1.5rem] bg-[#f4f6f1]">
          <div className="flex items-center justify-between border-b border-[#e3e8e0] px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#7b8982]">Vista general</p><p className="mt-1 text-sm font-semibold">Encuentro Horizonte</p></div><span className="rounded-full bg-[#e7f1dc] px-3 py-1.5 text-[11px] font-semibold text-[#416a3b]">● En curso</span></div>
          <div className="grid grid-cols-2 gap-3 p-5"><Metric label="Registrados" value="1,248" note="+12.8%"/><Metric label="Ingresados" value="936" note="75% del total"/>
            <div className="col-span-2 rounded-2xl border border-[#e5e9e2] bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-[#75817b]">Asistencia actual</p><p className="mt-2 text-3xl font-semibold tracking-tight">75<span className="text-[#8da18f]">%</span></p></div><div className="grid size-11 place-items-center rounded-xl bg-[#eff4e6] text-[#557c42]">↗</div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-[#edf0e9]"><div className="h-full w-3/4 rounded-full bg-[#9ebd57]"/></div><div className="mt-3 flex justify-between text-[11px] text-[#819088]"><span>936 personas ingresaron</span><span>312 pendientes</span></div></div>
            <div className="col-span-2 rounded-2xl bg-[#174f42] p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-xs text-white/65">Último ingreso</p><p className="mt-1 font-medium">Valeria Torres</p><p className="mt-1 text-[11px] text-white/55">Acceso general · hace 8 s</p></div><div className="grid size-11 place-items-center rounded-xl bg-white/10 text-[#d9f36b]">✓</div></div></div>
          </div><div className="flex items-center justify-between px-6 pb-5 text-[11px] text-[#8b9690]"><span>Panel de administración</span><span>Actualizado ahora</span></div>
        </div></div>
        <div className="absolute -bottom-6 right-2 flex items-center gap-3 rounded-2xl border border-white bg-white px-4 py-3 shadow-xl shadow-[#174f42]/10 sm:-right-5"><span className="grid size-9 place-items-center rounded-xl bg-[#eaf1dc] text-[#567a42]">⌁</span><div><p className="text-xs font-semibold">Acceso validado</p><p className="mt-0.5 text-[10px] text-[#839088]">Credencial de un solo uso</p></div><span className="ml-2 text-xs font-semibold text-[#527443]">✓</span></div>
      </div>
    </section>
    <section id="plataforma" className="bg-[#174f42] text-white"><div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#d9f36b]">Una base confiable</p><h2 className="mt-4 max-w-md text-3xl font-semibold leading-tight tracking-[-.035em] sm:text-4xl">Menos fricción en la puerta. Más claridad para el equipo.</h2></div><div className="grid gap-4 sm:grid-cols-3">{items.map(([n, title, text]) => <article key={n} className="rounded-2xl border border-white/15 bg-white/[.04] p-5"><p className="text-xs font-semibold text-[#d9f36b]">{n}</p><h3 className="mt-6 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/65">{text}</p></article>)}</div></div><div className="mt-16 flex flex-col justify-between gap-4 border-t border-white/15 pt-6 text-xs text-white/50 sm:flex-row"><span>pórtico. · Plataforma de registro y acceso</span><span>Una entrada bien organizada empieza aquí.</span></div></div></section>
  </main>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-2xl border border-[#e5e9e2] bg-white p-5"><p className="text-xs text-[#75817b]">{label}</p><div className="mt-3 flex items-end justify-between gap-2"><p className="text-2xl font-semibold tracking-tight">{value}</p><span className="pb-1 text-[10px] font-medium text-[#6d8b54]">{note}</span></div></div>;
}
