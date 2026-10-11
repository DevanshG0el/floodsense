"use client";

import Link from "next/link";
import React from "react";
import { LiquidNavbar } from "@/components/LiquidNavbar";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#cadde4] text-[#0a2540] selection:bg-[#288da6] selection:text-white">
      {/* -------------------- Floating pill navigation -------------------- */}
      <LiquidNavbar />

      {/* -------------------- Hero Section (Subtle Moody / "Little Dark" Video with High-Contrast Text) -------------------- */}
      {/* top padding keeps the text clear of the floating navbar (about 90px tall) */}
      <section className="relative flex min-h-[88vh] items-center overflow-hidden px-6 pb-16 pt-36 lg:px-12 lg:pt-40">
        {/* Full-width Street-Level Flood Video Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/street_flood_poster.jpg"
            className="h-full w-full object-cover brightness-[0.88] contrast-[1.05]"
          >
            <source src="/videos/street_flood.webm" type="video/webm" />
            <source src="/videos/flooded_town.mp4" type="video/mp4" />
          </video>

          {/* "Little Dark" Cinematic Oceanic Overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: `
                linear-gradient(135deg, 
                  rgba(13, 36, 46, 0.74) 0%, 
                  rgba(18, 48, 60, 0.62) 42%, 
                  rgba(25, 60, 75, 0.44) 75%, 
                  rgba(13, 36, 46, 0.35) 100%
                ),
                linear-gradient(to bottom, 
                  transparent 65%, 
                  rgba(202, 221, 228, 0.75) 88%, 
                  #cadde4 100%
                )
              `,
            }}
          />
        </div>

        {/* Hero Foreground Content: High-Contrast Luminous Typography */}
        <div className="relative z-20 mx-auto w-full max-w-7xl py-16 lg:py-20">
          <div className="max-w-xl lg:max-w-2xl">
            {/* Vibrant Sky Blue Tag */}
            <div className="mb-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-[#38bdf8] drop-shadow-xs">
              Street-Level Flood Intelligence
            </div>

            {/* Headline Quote */}
            <h1 className="text-3xl font-bold leading-[1.22] tracking-tight text-white drop-shadow-sm sm:text-4xl lg:text-[46px]">
              “When water rises faster than warnings, every second counts.”
            </h1>

            {/* Subheadline */}
            <p className="mt-5 text-base sm:text-lg font-normal leading-relaxed text-white/90 drop-shadow-xs">
              FloodSense predicts street-level flood risks hours before rain hits — pairing live
              monsoon forecasts with road elevation slopes and citizen reports to keep commuters safe
              and guide city crews to clear the most critical drains first.
            </p>
          </div>
        </div>
      </section>

      {/* -------------------- Section 2: Why Communities Choose FloodSense (Centered & Balanced) -------------------- */}
      <section id="why-floodsense" className="relative z-20 mx-auto max-w-7xl px-6 py-20 lg:px-12">
        <div className="mb-12 mx-auto max-w-3xl text-center">
          {/* Blue Title: Large & Bold */}
          <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#0284c7]">
            Why Communities Choose FloodSense
          </h2>
          {/* Black Text: Smaller than Blue */}
          <p className="mt-2 text-lg sm:text-xl font-medium text-[#0a2540]">
            Every flood is dynamic. Static maps arrive too late.
          </p>
        </div>

        {/* 4 Feature Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
          {/* Point 1 */}
          <div className="rounded-2xl border border-[#b8cbd4] bg-[#f3f8fa] p-7 shadow-xs transition hover:border-[#288da6]">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#dee9ee] text-[#0284c7]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#0a2540]">
                Predicts Flooding Before Rain Arrives
              </h3>
            </div>
            <p className="mt-4 text-sm font-normal leading-relaxed text-[#476877]">
              Pinpoints low-lying roads, underpasses, and dips prone to waterlogging hours in advance using terrain slopes and incoming rainfall forecasts — warning drivers before streets become impassable.
            </p>
          </div>

          {/* Point 2 */}
          <div className="rounded-2xl border border-[#b8cbd4] bg-[#f3f8fa] p-7 shadow-xs transition hover:border-[#288da6]">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#dee9ee] text-[#0284c7]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                  <circle cx="5" cy="6" r="2" fill="currentColor" />
                  <circle cx="19" cy="18" r="2" fill="currentColor" />
                </svg>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#0a2540]">
                Road-by-Road Color Coding (Red / Amber / Green)
              </h3>
            </div>
            <p className="mt-4 text-sm font-normal leading-relaxed text-[#476877]">
              Evaluates every street segment in real time. Commuters see hazardous waterlogged roads and safe, dry detour routes on a live map so nobody gets stranded in submerged underpasses.
            </p>
          </div>

          {/* Point 3 */}
          <div className="rounded-2xl border border-[#b8cbd4] bg-[#f3f8fa] p-7 shadow-xs transition hover:border-[#288da6]">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#dee9ee] text-[#0284c7]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#0a2540]">
                Citizen Photo Reports with Instant AI Verification
              </h3>
            </div>
            <p className="mt-4 text-sm font-normal leading-relaxed text-[#476877]">
              Citizens snap a photo of a blocked drain or overflowing puddle. Amazon Bedrock AI verifies the hazard in seconds, instantly feeding ground reality into the live flood risk calculation.
            </p>
          </div>

          {/* Point 4 */}
          <div className="rounded-2xl border border-[#b8cbd4] bg-[#f3f8fa] p-7 shadow-xs transition hover:border-[#288da6]">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#dee9ee] text-[#0284c7]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#0a2540]">
                Ranked Action List for Municipal Drain Crews
              </h3>
            </div>
            <p className="mt-4 text-sm font-normal leading-relaxed text-[#476877]">
              Eliminates guesswork for city workers. A ranked priority dispatch queue shows municipal teams which blocked drain to unclog first to save the highest number of roads from flooding.
            </p>
          </div>
        </div>
      </section>

      {/* -------------------- Section 3: Built for Everyone (Centered & Balanced) -------------------- */}
      <section id="solutions" className="relative z-20 mx-auto max-w-7xl px-6 py-16 lg:px-12">
        <div className="mb-12 mx-auto max-w-2xl text-center">
          {/* Blue Title: Large & Bold */}
          <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#0284c7]">
            Our Solutions
          </h2>
          {/* Black Text: Smaller than Blue */}
          <p className="mt-2 text-lg sm:text-xl font-medium text-[#0a2540]">
            Built for Commuters, Citizens & City Crews
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1: Commuters */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#b8cbd4] bg-[#f3f8fa] p-8 shadow-xs transition hover:border-[#288da6]">
            <div>
              <div className="inline-block rounded-full bg-[#dee9ee] px-3.5 py-1 text-xs font-bold text-[#0284c7]">
                COMMUTER DASHBOARD
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-tight text-[#0a2540]">
                Safe Dry Navigation & Risk Map
              </h3>
              <p className="mt-3 text-sm font-normal leading-relaxed text-[#476877]">
                Interactive 0–6 hour forecast map showing road-by-road flood risk (Red/Amber/Green), safe detours, and automated SMS warnings before you leave home.
              </p>
            </div>
            <div className="pt-6">
              <Link
                href="/map"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0284c7] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#0369a1] active:scale-95"
              >
                <span>Open Live Map</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Card 2: Citizens */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#288da6]/50 bg-[#f3f8fa] p-8 shadow-xs transition hover:border-[#288da6]">
            <div>
              <div className="inline-block rounded-full bg-[#288da6] px-3.5 py-1 text-xs font-bold text-white">
                CROWDSOURCED ACTION
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-tight text-[#0a2540]">
                Snap & Report Blocked Drains
              </h3>
              <p className="mt-3 text-sm font-normal leading-relaxed text-[#476877]">
                Found a clogged storm drain or flooded road? Snap a quick phone photo. AI verifies it on the spot and alerts both the public map and municipal crews.
              </p>
            </div>
            <div className="pt-6">
              <Link
                href="/report"
                className="inline-flex items-center gap-2 rounded-xl bg-[#288da6] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#207388] active:scale-95"
              >
                <span>Report Choked Drain</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Card 3: Drain Crews */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#b8cbd4] bg-[#f3f8fa] p-8 shadow-xs transition hover:border-[#288da6]">
            <div>
              <div className="inline-block rounded-full bg-[#dee9ee] px-3.5 py-1 text-xs font-bold text-[#0a2540]">
                MUNICIPAL DISPATCH
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-tight text-[#0a2540]">
                Ranked Drain Clearing Queue
              </h3>
              <p className="mt-3 text-sm font-normal leading-relaxed text-[#476877]">
                Field dashboard for municipal drain teams showing which drains to clean first to prevent the maximum number of streets from flooding before the rain arrives.
              </p>
            </div>
            <div className="pt-6">
              <Link
                href="/engineer"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#0a2540] border border-[#b8cbd4] shadow-xs transition hover:bg-[#dee9ee] active:scale-95"
              >
                <span>View Drain Queue</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- Closing Callout: Meaningful Quote (Clean & Unboxed) -------------------- */}
      <section className="relative z-20 mx-auto max-w-3xl px-6 py-16 text-center">
        <blockquote className="text-2xl font-bold italic tracking-tight text-[#0a2540] sm:text-3xl">
          “The best flood response is the one that happens before the water rises.”
        </blockquote>
        <p className="mx-auto mt-3 max-w-md text-sm font-normal leading-relaxed text-[#476877]">
          Connecting weather forecasts, elevation slopes, and citizen action to keep our streets safe.
        </p>
      </section>

      {/* -------------------- Footer -------------------- */}
      <footer className="relative z-20 border-t border-[#b8cbd4]/60 bg-[#dee9ee]/60 px-6 py-8 text-xs font-medium text-[#476877] lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0a2540]">FloodSense</span>
            <span>· Urban Flood Early Warning Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/map" className="hover:text-[#0a2540] font-semibold transition">
              Live Map
            </Link>
            <Link href="/report" className="hover:text-[#0a2540] font-semibold transition">
              Citizen Report
            </Link>
            <Link href="/engineer" className="hover:text-[#0a2540] font-semibold transition">
              Drain Crew
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
