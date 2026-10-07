import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";
const STORAGE_KEY = "theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

const readChoice = (): ThemeChoice => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
};

// index.html applies the same rule before first paint, so there is no flash of the wrong theme.
const apply = (choice: ThemeChoice) => {
  const dark = choice === "dark" || (choice === "system" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
  return dark ? "dark" : "light";
};

interface ThemeState {
  theme: ThemeChoice;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeChoice>(readChoice);
  const [resolvedTheme, setResolved] = useState<"light" | "dark">(() => apply(readChoice()));

  useEffect(() => {
    setResolved(apply(theme));
    if (theme !== "system") return;
    const mq = media();
    const onChange = () => setResolved(apply("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable (private mode): the choice lasts for this visit
    }
    setThemeState(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
};
