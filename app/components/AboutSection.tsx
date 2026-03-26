"use client";

import { motion } from "framer-motion";
import SectionWrapper from "./SectionWrapper";
import {
  slideInLeft,
  slideInRight,
  staggerItem,
  staggerContainer,
} from "@/lib/animations";
import { ABOUT, TEAM } from "@/data/content";

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Styled initials placeholder — used until real photos exist */
function InitialsAvatar({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div
      className={`flex items-center justify-center w-full h-full ${className}`}
      style={{
        background:
          "linear-gradient(145deg, #1C1917 0%, #292524 50%, #44403C 100%)",
      }}
      aria-hidden="true"
    >
      <span
        className="text-gold-gradient select-none"
        style={{ fontFamily: "var(--font-bungee)", fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
      >
        {initials}
      </span>
    </div>
  );
}

// ── Left column ───────────────────────────────────────────────────────────────

function StoryColumn() {
  const founder = TEAM[0];

  return (
    <motion.div
      variants={slideInLeft}
      className="flex flex-col justify-center gap-6 lg:gap-7 lg:pr-8"
    >
      {/* Section label */}
      <p
        className="text-[11px] tracking-[0.35em] uppercase"
        style={{ fontFamily: "var(--font-source-code-pro)", color: "#CA8A04" }}
      >
        {ABOUT.label}
      </p>

      {/* Heading */}
      <h2
        className="text-4xl md:text-5xl lg:text-6xl text-white leading-tight"
        style={{ fontFamily: "var(--font-bungee)", letterSpacing: "0.02em" }}
      >
        {ABOUT.heading.split("\n").map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </h2>

      {/* Story paragraphs */}
      <div className="flex flex-col gap-4">
        {ABOUT.paragraphs.map((para, i) => (
          <p
            key={i}
            className="text-base leading-[1.8]"
            style={{
              fontFamily: "var(--font-inter)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            {para}
          </p>
        ))}
      </div>

      {/* Mini stats — same treatment as Hero stats bar */}
      <div
        className="grid grid-cols-2 gap-6 pt-8 mt-2"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        {ABOUT.miniStats.map(({ number, label }, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span
              className="text-3xl md:text-4xl leading-none text-gold-gradient"
              style={{ fontFamily: "var(--font-bungee)" }}
            >
              {number}
            </span>
            <span
              className="text-[10px] tracking-widest uppercase"
              style={{
                fontFamily: "var(--font-source-code-pro)",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Right column — founder portrait ──────────────────────────────────────────

function FounderPortrait() {
  const founder = TEAM[0];

  return (
    <motion.div
      variants={slideInRight}
      className="relative flex justify-center lg:justify-end"
    >
      {/*
        Outer wrapper provides space for the decorative frame
        that bleeds 14 px bottom-right.
      */}
      <div className="relative w-full max-w-[420px] pb-3.5 pr-3.5">

        {/* ── Decorative gold frame (offset behind) ── */}
        <div
          className="absolute bottom-0 right-0 rounded-2xl pointer-events-none"
          style={{
            /* Frame sits 14px down-right of the image container */
            top: "14px",
            left: "14px",
            border: "1px solid rgba(212, 160, 23, 0.35)",
            borderRadius: "16px",
            /* Second inner rule: thin gold line 6px further in */
            outline: "1px solid rgba(212, 160, 23, 0.12)",
            outlineOffset: "-7px",
          }}
          aria-hidden="true"
        />

        {/* ── Image container ── */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            aspectRatio: "3 / 4",
            boxShadow:
              "0 20px 60px rgba(0,0,0,0.65), 0 0 40px rgba(0,0,0,0.3)",
          }}
        >
          {/* Placeholder — swap src on img tag once real photo exists */}
          <InitialsAvatar
            name={founder.name}
            className="absolute inset-0"
          />

          {/* Subtle gradient over placeholder so the glass card is readable */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 45%, transparent 70%)",
            }}
            aria-hidden="true"
          />

          {/* ── Glass name + title overlay ── */}
          <div
            className="absolute bottom-4 left-4 right-4 rounded-xl px-4 py-3"
            style={{
              background: "rgba(10, 10, 10, 0.68)",
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <p
              className="text-white text-base leading-tight"
              style={{
                fontFamily: "var(--font-bungee)",
                letterSpacing: "0.03em",
              }}
            >
              {founder.name}
            </p>
            <p
              className="text-[11px] tracking-wider mt-0.5"
              style={{
                fontFamily: "var(--font-source-code-pro)",
                color: "#CA8A04",
              }}
            >
              {founder.role}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Team row ──────────────────────────────────────────────────────────────────

function TeamRow() {
  return (
    <>
      {/* Row header */}
      <motion.div
        variants={staggerItem}
        className="mt-20 mb-10 flex flex-col items-center gap-3"
      >
        <p
          className="text-[11px] tracking-[0.35em] uppercase"
          style={{ fontFamily: "var(--font-source-code-pro)", color: "#CA8A04" }}
        >
          // The Crew
        </p>
        <h3
          className="text-2xl md:text-3xl text-white"
          style={{ fontFamily: "var(--font-bungee)", letterSpacing: "0.03em" }}
        >
          Meet The Team
        </h3>
        <div
          className="h-px w-12 rounded-full"
          style={{
            background:
              "linear-gradient(to right, transparent, #CA8A04, #F0C040, transparent)",
          }}
        />
      </motion.div>

      {/* Cards — nested stagger */}
      <motion.div
        variants={staggerContainer}
        className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto"
      >
        {TEAM.map((member) => (
          <motion.article
            key={member.id}
            variants={staggerItem}
            className="flex flex-col items-center gap-4 p-6 rounded-2xl text-center
              transition-colors duration-200"
            style={{
              background: "rgba(10, 10, 10, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            {/* Circular photo */}
            <div
              className="relative w-20 h-20 rounded-full overflow-hidden shrink-0 ring-2"
              style={{ boxShadow: "0 0 0 2px rgba(212,160,23,0.2)" }}
            >
              <InitialsAvatar name={member.name} className="rounded-full" />
            </div>

            {/* Name */}
            <div className="flex flex-col gap-1">
              <p
                className="text-white text-base leading-tight"
                style={{
                  fontFamily: "var(--font-bungee)",
                  letterSpacing: "0.03em",
                }}
              >
                {member.name}
              </p>
              <p
                className="text-[11px] tracking-wider"
                style={{
                  fontFamily: "var(--font-source-code-pro)",
                  color: "#CA8A04",
                }}
              >
                {member.role}
              </p>
            </div>

            {/* Specialties */}
            <div className="flex flex-wrap justify-center gap-1.5">
              {member.specialties.map((s) => (
                <span
                  key={s}
                  className="text-[9px] tracking-wider uppercase px-2.5 py-1 rounded-full"
                  style={{
                    fontFamily: "var(--font-source-code-pro)",
                    color: "rgba(255,255,255,0.45)",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </motion.article>
        ))}
      </motion.div>
    </>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function AboutSection() {
  return (
    <SectionWrapper
      id="about"
      style={{
        background:
          "radial-gradient(ellipse at 80% 30%, rgba(28,25,23,0.7) 0%, #0A0A0A 60%)",
      } as React.CSSProperties}
    >
      {/* Top edge divider — consistent with Services */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, rgba(212,160,23,0.15) 30%, rgba(212,160,23,0.15) 70%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto">
        {/* Two-column split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 lg:gap-20 items-center">
          <StoryColumn />
          <FounderPortrait />
        </div>

        {/* Team row — stagger fires after main columns */}
        <TeamRow />
      </div>
    </SectionWrapper>
  );
}
