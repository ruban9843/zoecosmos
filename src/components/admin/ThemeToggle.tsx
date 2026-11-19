"use client";
import { useState } from "react";

export type AdminTheme = "light" | "dark";

/** Flips the admin colour scheme and remembers it in a cookie the layout reads on the server. */
export default function ThemeToggle({ initial }: { initial: AdminTheme }) {
  const [theme, setTheme] = useState<AdminTheme>(initial);

  const toggle = () => {
    const next: AdminTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.querySelector(".ad-frame")?.setAttribute("data-theme", next);
    document.cookie = `ad_theme=${next}; path=/admin; max-age=31536000; samesite=lax`;
  };

  return (
    <button
      type="button"
      className="ad-theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="10" cy="10" r="3.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M16 12.5A6.5 6.5 0 0 1 7.5 4a6.5 6.5 0 1 0 8.5 8.5Z" />
        </svg>
      )}
    </button>
  );
}
