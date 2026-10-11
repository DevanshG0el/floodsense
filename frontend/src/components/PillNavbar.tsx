"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/*
  Floating pill navbar for the landing page: logo tile, menu triggers that open a
  panel (blurb on the left, link cards on the right), a CTA, and a burger drawer on
  phones. Opens on hover with a pointer, toggles on click, closes on Escape, outside
  click or when the pointer leaves the bar.
*/

type Card = { title: string; text: string; href: string };
type Menu = {
  label: string;
  href?: string;
  eyebrow?: string;
  blurb?: string;
  more?: { label: string; href: string };
  cards?: Card[];
};

const REPO = "https://github.com/DevanshG0el/floodsense";

const MENUS: Menu[] = [
  {
    label: "Product",
    eyebrow: "Product",
    blurb: "Street-level flood warnings for Central Delhi, hours before the water rises.",
    more: { label: "Open the flood map", href: "/map" },
    cards: [
      { title: "Flood map", text: "Every road coloured for the next six hours, with the reason why.", href: "/map" },
      { title: "Ask FloodSense", text: "An AI agent answers “will my road flood?” in English or Hindi.", href: "/map" },
      { title: "Citizen report", text: "Photograph a blocked drain; AI checks it and the map updates.", href: "/report" },
      { title: "Drain crew", text: "Which drain to clean first, and which roads it keeps dry.", href: "/engineer" },
    ],
  },
  {
    label: "How it works",
    eyebrow: "How it works",
    blurb: "Rain forecast, road elevation and drain condition, scored for every 150 m of road.",
    more: { label: "Why FloodSense", href: "#why-floodsense" },
    cards: [
      { title: "Why FloodSense", text: "Rain alone does not predict flooding. Low roads with blocked drains do.", href: "#why-floodsense" },
      { title: "Solutions", text: "One tool for commuters, residents and the city’s drain crews.", href: "#solutions" },
      { title: "Built on AWS", text: "Bedrock, a Strands agent, Lambda, DynamoDB, SNS, Polly and Amplify.", href: REPO },
      { title: "Data sources", text: "Open-Meteo rain, Copernicus elevation on AWS, OpenStreetMap roads.", href: `${REPO}#data-sources` },
    ],
  },
  { label: "Report", href: "/report" },
];

const CTA = { label: "Launch Dashboard", href: "/map" };
const MOBILE_BELOW = 860;

function NavLink({ href, className, children, onClick }: {
  href: string; className?: string; children: React.ReactNode; onClick?: () => void;
}) {
  if (href.startsWith("http")) {
    return <a href={href} className={className} onClick={onClick} target="_blank" rel="noreferrer">{children}</a>;
  }
  if (href.startsWith("#")) {
    return <a href={href} className={className} onClick={onClick}>{children}</a>;
  }
  return <Link href={href} className={className} onClick={onClick}>{children}</Link>;
}

function Mark() {
  return (
    <svg viewBox="0 0 36 36" className="h-7 w-7" fill="none" aria-hidden>
      <path d="M18 6C18 6 10.5 15 10.5 20.5C10.5 24.6 13.9 28 18 28C22.1 28 25.5 24.6 25.5 20.5C25.5 15 18 6 18 6Z" fill="white" />
      <path d="M13.5 20.4C15 19 16.5 19 18 20.4C19.5 21.8 21 21.8 22.5 20.4" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
      <path d="M14.5 23.6C15.7 22.6 16.8 22.6 18 23.6C19.2 24.6 20.3 24.6 21.5 23.6" stroke="#0284c7" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.75" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className={`pm-chevron ${open ? "pm-chevron-open" : ""}`} aria-hidden>
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PillNavbar() {
  const [open, setOpen] = useState<number | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [row, setRow] = useState<number | null>(null);
  const shell = useRef<HTMLDivElement>(null);

  const closeAll = useCallback(() => {
    setOpen(null);
    setDrawer(false);
    setRow(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAll();
    const onDown = (e: MouseEvent) => {
      if (shell.current && !shell.current.contains(e.target as Node)) closeAll();
    };
    const mq = window.matchMedia(`(max-width: ${MOBILE_BELOW - 1}px)`);
    mq.addEventListener("change", closeAll);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      mq.removeEventListener("change", closeAll);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [closeAll]);

  const hoverable = () => window.matchMedia("(hover: hover)").matches;
  const menu = open !== null ? MENUS[open] : null;

  return (
    <div className="pm-root">
      <div className="pm-shell" ref={shell} onMouseLeave={() => hoverable() && setOpen(null)}>
        <div className="pm-bar">
          <Link href="/" className="pm-brand" onClick={closeAll}>
            <span className="pm-badge">
              <Mark />
            </span>
            <span className="pm-name">FloodSense</span>
          </Link>

          <nav className="pm-nav" aria-label="Main">
            {MENUS.map((m, i) =>
              m.cards ? (
                <button
                  key={m.label}
                  type="button"
                  className={`pm-trigger ${open === i ? "pm-trigger-open" : ""}`}
                  aria-expanded={open === i}
                  onMouseEnter={() => hoverable() && setOpen(i)}
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  {m.label}
                  <Chevron open={open === i} />
                </button>
              ) : (
                <NavLink
                  key={m.label}
                  href={m.href!}
                  className="pm-trigger"
                  onClick={closeAll}
                >
                  <span onMouseEnter={() => hoverable() && setOpen(null)}>{m.label}</span>
                </NavLink>
              ),
            )}
          </nav>

          <NavLink href={CTA.href} className="pm-cta" onClick={closeAll}>
            {CTA.label}
          </NavLink>

          <button
            type="button"
            className={`pm-burger ${drawer ? "pm-burger-open" : ""}`}
            aria-label={drawer ? "Close menu" : "Open menu"}
            aria-expanded={drawer}
            onClick={() => setDrawer((d) => !d)}
          >
            <span />
            <span />
          </button>
        </div>

        {menu?.cards && (
          <div className="pm-panel" key={menu.label} role="region" aria-label={menu.label}>
            <div className="pm-aside">
              <div className="pm-eyebrow">{menu.eyebrow}</div>
              <p className="pm-blurb">{menu.blurb}</p>
              {menu.more && (
                <NavLink href={menu.more.href} className="pm-more" onClick={closeAll}>
                  {menu.more.label} →
                </NavLink>
              )}
            </div>
            <div className="pm-cards">
              {menu.cards.map((c) => (
                <NavLink key={c.title} href={c.href} className="pm-card" onClick={closeAll}>
                  <span className="pm-card-title">
                    {c.title}
                    <span className="pm-arrow" aria-hidden>→</span>
                  </span>
                  <span className="pm-card-text">{c.text}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}

        {drawer && (
          <div className="pm-drawer">
            {MENUS.map((m, i) =>
              m.cards ? (
                <div key={m.label} className="pm-row">
                  <button
                    type="button"
                    className="pm-row-head"
                    aria-expanded={row === i}
                    onClick={() => setRow(row === i ? null : i)}
                  >
                    {m.label}
                    <span className={`pm-plus ${row === i ? "pm-plus-open" : ""}`} aria-hidden />
                  </button>
                  <div className={`pm-row-body ${row === i ? "pm-row-body-open" : ""}`}>
                    <div>
                      {m.cards.map((c) => (
                        <NavLink key={c.title} href={c.href} className="pm-sub" onClick={closeAll}>
                          {c.title}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={m.label} className="pm-row">
                  <NavLink href={m.href!} className="pm-row-head" onClick={closeAll}>
                    {m.label}
                  </NavLink>
                </div>
              ),
            )}
            <NavLink href={CTA.href} className="pm-drawer-cta" onClick={closeAll}>
              {CTA.label}
            </NavLink>
          </div>
        )}
      </div>
    </div>
  );
}
