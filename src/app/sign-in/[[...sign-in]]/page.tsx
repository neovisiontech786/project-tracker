import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import { CheckCircle2, FolderKanban, LockKeyhole, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-provider";

export default function SignInPage() {
  return (
    <main className="signin-page hub-login">
      <ThemeToggle className="login-theme-toggle"/>
      <div className="hub-login-shell">
        <section className="hub-login-story" aria-label="About Neo Vision Tech Project Hub">
          <div className="hub-login-story-content">
            <div className="hub-login-brand">
              <div className="hub-login-emblem">
                <Image
                  src="/branding/neo-vision-mark.webp"
                  alt="Neo Vision Tech eye emblem"
                  width={66}
                  height={66}
                  priority
                />
              </div>
              <div className="hub-login-brand-copy">
                <span>NEO VISION TECH</span>
                <strong>Project Hub</strong>
              </div>
            </div>

            <div className="hub-login-hero">
              <div className="hub-login-kicker"><span /> YOUR PRIVATE WORKSPACE</div>
              <h1>Less tracking.<br /><span>More building.</span></h1>
              <p>
                A focused home for every client project and internal product.
                Stay aligned, keep documents organized, and know exactly what
                needs attention.
              </p>
            </div>

            <div className="hub-login-benefits">
              <div className="hub-login-benefit">
                <div className="hub-login-benefit-icon"><CheckCircle2 size={19} /></div>
                <div><strong>Everything in sync</strong><span>Shared updates for Kabir and Naushad.</span></div>
              </div>
              <div className="hub-login-benefit">
                <div className="hub-login-benefit-icon"><FolderKanban size={19} /></div>
                <div><strong>Clear project progress</strong><span>Track status, deadlines, notes and files.</span></div>
              </div>
              <div className="hub-login-benefit">
                <div className="hub-login-benefit-icon"><LockKeyhole size={19} /></div>
                <div><strong>Privacy when you need it</strong><span>Keep selected projects visible only to you.</span></div>
              </div>
            </div>
            <div className="hub-login-story-footer">
              <ShieldCheck size={16} />
              <span>Secure founder-only workspace · Powered by Clerk</span>
            </div>
          </div>
        </section>

        <section className="hub-login-auth" aria-label="Sign in">
          <div className="hub-login-auth-inner">
            <div className="hub-login-auth-top">
              <span className="hub-login-auth-pill"><ShieldCheck size={14} /> SECURE SIGN IN</span>
              <p>Access your Neo Vision Tech workspace.</p>
            </div>
            <div className="hub-login-clerk">
              <SignIn routing="path" path="/sign-in" forceRedirectUrl="/dashboard" />
            </div>
            <p className="hub-login-auth-footer">
              Authorized access for Neo Vision Tech founders only.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
