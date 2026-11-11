import type { Metadata } from "next";
import "./globals.css";
import { ProjectStoreProvider } from "@/lib/project-store";
import { AppShell } from "@/components/app-shell";
import { AppFrame } from "@/components/app-frame";
export const metadata:Metadata={title:"Neo Vision Tech | Project Hub",description:"A clear, focused home for Neo Vision Tech projects."};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body><ProjectStoreProvider><AppFrame>{children}</AppFrame></ProjectStoreProvider></body></html>;
}
