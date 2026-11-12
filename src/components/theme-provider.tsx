"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

export type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = "nvt-project-hub-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function isPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function applyTheme(preference: ThemePreference): ResolvedTheme {
  const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = preference === "system" ? (isSystemDark ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setCurrentPreference] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initialPreference: ThemePreference = isPreference(stored) ? stored : "system";
    setCurrentPreference(initialPreference);
    setResolvedTheme(applyTheme(initialPreference));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = window.localStorage.getItem(STORAGE_KEY);
      const active: ThemePreference = isPreference(current) ? current : "system";
      if (active === "system") setResolvedTheme(applyTheme("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setCurrentPreference(next);
    setResolvedTheme(applyTheme(next));
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setPreference } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className={`icon-button theme-toggle ${className}`.trim()}
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {resolvedTheme === "dark" ? <Sun size={19} strokeWidth={1.9} /> : <Moon size={19} strokeWidth={1.9} />}
    </button>
  );
}
