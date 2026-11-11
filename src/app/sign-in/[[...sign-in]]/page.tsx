import {SignIn} from '@clerk/nextjs';
import {ShieldCheck} from 'lucide-react';
export default function SignInPage(){
 return <main className="signin-page"><div className="signin-card" style={{maxWidth:480}}><div className="signin-accent"/><div className="signin-card-content"><div className="signin-logo"><span className="brand-mark-line"/></div><span className="signin-eyebrow">FOUNDERS WORKSPACE</span><h1>Welcome back</h1><p>Sign in to Neo Vision Tech Project Hub</p><div style={{display:'flex',justifyContent:'center'}}><SignIn routing="path" path="/sign-in" forceRedirectUrl="/dashboard"/></div></div><div className="signin-foot"><span className="owner-avatar avatar-k">N</span><div><strong>Neo Vision Tech</strong><small>Private internal workspace</small></div></div></div><div className="signin-security"><ShieldCheck size={15}/> Access restricted to two authorized founders</div></main>;
}
