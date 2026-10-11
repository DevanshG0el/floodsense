"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/*
  "Liquid glass" navbar for the landing page: a chrome rim around a frosted pill, links
  that lift into a glass bubble on hover, and a glossy black CTA with a sweeping shine.
  On phones the pill grows into a stacked menu behind a round glass toggle.
*/

const LINKS = [
  { label: "Flood map", href: "/map" },
  { label: "Report", href: "/report" },
  { label: "Drain crew", href: "/engineer" },
  { label: "Why FloodSense", href: "#why-floodsense" },
];
const CTA = { label: "Launch Dashboard", href: "/map" };

function Item({ href, className, children, onClick }: {
  href: string; className: string; children: React.ReactNode; onClick?: () => void;
}) {
  return href.startsWith("#") ? (
    <a href={href} className={className} onClick={onClick}>{children}</a>
  ) : (
    <Link href={href} className={className} onClick={onClick}>{children}</Link>
  );
}

function Gem() {
  return (
    <span className="lg-gem" aria-hidden>
      <span className="lg-gem-body">
        <svg viewBox="0 0 24 24" className="lg-gem-drop">
          <path d="M12 4.5C12 4.5 7 10.4 7 14a5 5 0 0 0 10 0c0-3.6-5-9.5-5-9.5Z" fill="#fff" />
        </svg>
      </span>
    </span>
  );
}

export function LiquidNavbar() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  const close = () => setOpen(false);

  return (
    <div className="lg-root">
      <nav ref={ref} className={`lg-nav ${open ? "lg-open" : ""}`} aria-label="Main">
        <div className="lg-inner">
          <div className="lg-top">
            <Link href="/" className="lg-brand" onClick={close}>
              <Gem />
              FloodSense
            </Link>
            <button
              type="button"
              className="lg-toggle"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <span />
              <span />
            </button>
          </div>

          <div className="lg-menu">
            <div className="lg-menu-inner">
              <div className="lg-links">
                {LINKS.map((l) => (
                  <Item key={l.label} href={l.href} className="lg-link" onClick={close}>
                    {l.label}
                  </Item>
                ))}
              </div>
              <Item href={CTA.href} className="lg-cta" onClick={close}>
                <span className="lg-shine" aria-hidden />
                <span className="lg-cta-label">{CTA.label}</span>
              </Item>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
