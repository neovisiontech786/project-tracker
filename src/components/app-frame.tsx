"use client";
import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";
export function AppFrame({children}:{children:React.ReactNode}){
 const pathname=usePathname();
 return (pathname==="/sign-in"||pathname==="/sign-up")?<>{children}</>:<AppShell>{children}</AppShell>;
}
