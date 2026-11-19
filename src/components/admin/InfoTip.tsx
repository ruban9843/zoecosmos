"use client";
import { useId, useState } from "react";

/** Small ⓘ button that reveals an explanatory card on hover, focus or tap. */
export default function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="ad-infotip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="ad-infotip-btn"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      >
        i
      </button>
      {open && (
        <span role="tooltip" id={id} className="ad-infotip-card">
          <b>{label}</b>
          {children}
        </span>
      )}
    </span>
  );
}
