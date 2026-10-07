import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Pórtico — Control de acceso QR", description: "Registro y control de acceso con códigos QR." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="es"><body>{children}</body></html>;
}
