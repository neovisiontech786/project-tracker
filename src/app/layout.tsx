import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "./dark.css";
import { ProjectStoreProvider } from "@/lib/project-store";
import { AppFrame } from "@/components/app-frame";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Neo Vision Tech | Project Hub",
  description: "A focused, private workspace for Neo Vision Tech projects.",
};

// Apply the saved theme before CSS is painted to prevent a light-theme flash.
const initialThemeScript = `(function(){try{var p=localStorage.getItem("nvt-project-hub-theme");if(p!=="light"&&p!=="dark")p="system";var dark=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var theme=dark?"dark":"light";document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(e){document.documentElement.dataset.theme="light";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );

  if (!configured) {
    return (
      <html lang="en" suppressHydrationWarning>
        <head><script dangerouslySetInnerHTML={{ __html: initialThemeScript }} /></head>
        <body>
          <ThemeProvider>
            <main className="signin-page">
              <div className="signin-card">
                <div className="signin-accent" />
                <div className="signin-card-content">
                  <div className="signin-logo"><span className="brand-mark-line" /></div>
                  <h1>Workspace setup required</h1>
                  <p>Clerk authentication must be configured before this private workspace can be opened.</p>
                  <div className="signin-notice">
                    Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in Vercel project environment variables.
                  </div>
                </div>
              </div>
            </main>
          </ThemeProvider>
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head><script dangerouslySetInnerHTML={{ __html: initialThemeScript }} /></head>
        <body>
          <ThemeProvider>
            <ProjectStoreProvider>
              <AppFrame>{children}</AppFrame>
            </ProjectStoreProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
