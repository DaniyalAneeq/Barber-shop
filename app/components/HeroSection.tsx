"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fadeUp } from "@/lib/animations";
import { HERO, STATS } from "@/data/content";
import Link from "next/link";

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="home"
      className="relative w-full h-screen min-h-[620px] overflow-hidden"
    >
      {/* ── Background video ──────────────────────────────────── */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover scale-[1.03]"
        style={{ willChange: "transform" }}
      >
        <source src={HERO.videoSrc} type="video/mp4" />
      </video>

      {/* ── Cinematic gradient overlays ───────────────────────── */}
      {/* Bottom-up dark for text readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: [
            "linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.72) 28%, rgba(0,0,0,0.25) 58%, transparent 82%)",
            "linear-gradient(to right, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.22) 42%, transparent 68%)",
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.45) 100%)",
          ].join(", "),
        }}
      />

      {/* ── Hero content ──────────────────────────────────────── */}
      <div className="relative z-10 h-full flex flex-col justify-end pb-14 md:pb-16 lg:pb-20 px-6 sm:px-10 md:px-16 lg:px-24">
        <div className="max-w-3xl">

          {/* Gold accent line */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            className="w-14 h-px mb-8 origin-left rounded-full"
            style={{ background: "linear-gradient(to right, #CA8A04, #F0C040, transparent)" }}
          />

          {/* Main headline */}
          <motion.h1
            variants={fadeUp(0.25)}
            initial="hidden"
            animate="visible"
            className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl
              font-normal text-white leading-tight mb-4"
            style={{
              fontFamily: "var(--font-bungee)",
              letterSpacing: "0.04em",
            }}
          >
            Look Sharp.
            <br />
            <span style={{ color: "#D4A017" }}>Feel </span>
            Unstoppable.
          </motion.h1>

          {/* Subheading */}
          <motion.p
            variants={fadeUp(0.42)}
            initial="hidden"
            animate="visible"
            className="text-base md:text-lg lg:text-xl font-light leading-[1.75] mb-14 max-w-[520px]"
            style={{
              fontFamily: "var(--font-inter)",
              color: "rgba(255,255,255,0.72)",
              letterSpacing: "0.01em",
            }}
          >
            Premium haircuts and precision fades crafted for modern men.
          </motion.p>

          {/* CTA button */}
          <motion.div
            variants={fadeUp(0.58)}
            initial="hidden"
            animate="visible"
          >
            <Link href="#contact">
            <button
              className="btn-gold inline-flex items-center gap-3 px-8 py-4 rounded-full
              font-semibold text-sm md:text-base tracking-wider uppercase cursor-pointer"
              style={{
                fontFamily: "var(--font-inter)",
                color: "#0A0A0A",
              }}
            >
              Book Your Appointment
              {/* Arrow icon */}
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </button>
            </Link>
          </motion.div>

          {/* Stats row */}
          <motion.div
            variants={fadeUp(0.72)}
            initial="hidden"
            animate="visible"
            className="flex items-center gap-8 mt-12"
          >
            {STATS.map(({ number, label }, i) => (
              <div key={label} className="flex items-center gap-8">
                {i !== 0 && (
                  <div
                    className="w-px h-8 shrink-0"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  />
                )}
                <div className="flex flex-col gap-0.5">
                  <span
                    className="text-2xl md:text-3xl leading-none"
                    style={{ fontFamily: "var(--font-bungee)", color: "#D4A017" }}
                  >
                    {number}
                  </span>
                  <span
                    className="text-[10px] tracking-widest uppercase"
                    style={{
                      fontFamily: "var(--font-source-code-pro)",
                      color: "rgba(255,255,255,0.38)",
                    }}
                  >
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Scroll indicator ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3, duration: 0.7 }}
        className="absolute bottom-8 right-8 md:right-16 flex flex-col items-center gap-2"
        aria-hidden="true"
      >
        <div
          className="w-5 h-8 rounded-full border flex items-start justify-center pt-1.5"
          style={{ borderColor: "rgba(255,255,255,0.2)" }}
        >
          <motion.div
            animate={prefersReducedMotion ? {} : { y: [0, 9, 0] }}
            transition={{ repeat: Infinity, duration: 1.9, ease: "easeInOut" }}
            className="w-1 h-2 rounded-full"
            style={{ background: "rgba(212,160,23,0.75)" }}
          />
        </div>
        <span
          className="text-[9px] tracking-[0.3em] uppercase"
          style={{
            fontFamily: "var(--font-source-code-pro)",
            color: "rgba(255,255,255,0.28)",
          }}
        >
          Scroll
        </span>
      </motion.div>
    </section>
  );
}
