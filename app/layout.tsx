import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pórtico — Accesos bajo control",
  description: "Registro y control de acceso con códigos QR de un solo uso.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
