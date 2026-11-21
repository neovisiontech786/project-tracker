import { SignUp } from "@clerk/nextjs";
export default function SignUpPage(){
 return <main className="signin-page hub-login"><div className="hub-login-shell">
  <section className="hub-login-story" aria-label="About Neo Vision Tech">
   <div className="hub-login-story-content"><h1>Join Neo Vision Tech</h1>
    <p>Create your account using the email address that received your team invitation.</p>
    <p>Access to the workspace is activated only after your email is verified.</p></div>
  </section>
  <section className="hub-login-auth"><div className="hub-login-auth-inner">
   <SignUp routing="path" path="/sign-up" forceRedirectUrl="/dashboard"/>
  </div></section>
 </div></main>;
}
