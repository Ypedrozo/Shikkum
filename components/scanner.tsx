"use client";
import { useEffect, useRef, useState } from "react";
type Result={result:string;participant?:{first_name:string;last_name:string;checked_in_at:string|null}};
const copy:Record<string,[string,string]>={authorized:["✓ INGRESO AUTORIZADO","success"],already_used:["⚠ USUARIO YA REGISTRADO","warning"],cancelled:["⚠ QR ANULADO","warning"],invalid:["⚠ QR NO VÁLIDO","error"]};
export function Scanner() {
 const ref=useRef<any>(null),busy=useRef(false);const [message,setMessage]=useState("");const [result,setResult]=useState<Result|null>(null);const [scanning,setScanning]=useState(false);const [error,setError]=useState("");
 useEffect(()=>()=>{ref.current?.stop().catch(()=>{});},[]);
 async function start(){
  setError("");setResult(null);setMessage("");
  try {
   const {Html5Qrcode}=await import("html5-qrcode");const scanner=new Html5Qrcode("qr-reader");ref.current=scanner;
   await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:250,height:250}},async(text:string)=>{
    if(busy.current)return;busy.current=true;setMessage("Validando…");
    try{await scanner.pause(true);const r=await fetch("/api/check-in",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:text,deviceInfo:navigator.userAgent})});const d=await r.json();if(!r.ok)throw Error(d.error);setResult(d);setMessage("");}
    catch(e){setError(e instanceof Error?e.message:"No fue posible validar el código.");setMessage("");}
    finally{setTimeout(()=>{busy.current=false;},1800);}
   },()=>{});
   setScanning(true);
  }catch(e){setError(e instanceof Error&&/NotAllowed|Permission|permission/i.test(e.message)?"No fue posible acceder a la cámara. Revisa los permisos del navegador.":"No fue posible acceder a la cámara. Usa HTTPS o localhost y permite el acceso.");}
 }
 async function resume(){setResult(null);setError("");busy.current=false;try{await ref.current?.resume();}catch{}}
 async function stop(){try{await ref.current?.stop();}catch{}setScanning(false);setResult(null);}
 const outcome=result?copy[result.result]:null;
 return <div className="scannerlayout"><div className="scannercard"><div id="qr-reader" className="reader"/>{message&&<p className="muted center">{message}</p>}{error&&<p className="notice error">{error}</p>}
 {!scanning?<button className="button primary full" onClick={start}>📷 Activar cámara</button>:<button className="button secondary full" onClick={stop}>Detener cámara</button>}</div>
 {result&&outcome&&<section className={`scanresult ${outcome[1]}`}><h2>{outcome[0]}</h2>{result.participant&&<><p className="personname">{result.participant.first_name} {result.participant.last_name}</p><p>{result.result==="authorized"?"Hora": "Ingresó"}: {result.participant.checked_in_at?new Date(result.participant.checked_in_at).toLocaleString("es-EC",{hour12:false}):"—"}</p></>}<button className="button secondary" onClick={resume}>Escanear siguiente</button></section>}
 <p className="scannerhint">Apunta la cámara al código QR. El resultado se valida directamente en Supabase.</p></div>
}
