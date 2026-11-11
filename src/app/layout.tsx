import type {Metadata} from 'next';
import {ClerkProvider} from '@clerk/nextjs';
import './globals.css';
import {ProjectStoreProvider} from '@/lib/project-store';
import {AppFrame} from '@/components/app-frame';
export const metadata:Metadata={title:'Neo Vision Tech | Project Hub',description:'A focused, private workspace for Neo Vision Tech projects.'};
export default function RootLayout({children}:{children:React.ReactNode}){
 const configured=Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY&&process.env.CLERK_SECRET_KEY);
 if(!configured)return <html lang="en"><body><main className="signin-page"><div className="signin-card"><div className="signin-accent"/><div className="signin-card-content"><div className="signin-logo"><span className="brand-mark-line"/></div><h1>Workspace setup required</h1><p>Clerk authentication must be configured before this private workspace can be opened.</p><div className="signin-notice">Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in Vercel project environment variables.</div></div></div></main></body></html>;
 return <ClerkProvider><html lang="en"><body><ProjectStoreProvider><AppFrame>{children}</AppFrame></ProjectStoreProvider></body></html></ClerkProvider>;
}
