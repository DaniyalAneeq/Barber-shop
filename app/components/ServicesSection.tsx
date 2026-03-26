"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ClockIcon } from "@heroicons/react/24/outline";
import SectionWrapper from "./SectionWrapper";
import { staggerItem } from "@/lib/animations";
import { SERVICES } from "@/data/content";

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader() {
  return (
    <motion.div
      variants={staggerItem}
      className="text-center mb-16"
    >
      {/* Eyebrow label */}
      <p
        className="text-[11px] tracking-[0.35em] uppercase mb-4"
        style={{ fontFamily: "var(--font-source-code-pro)", color: "#CA8A04" }}
      >
        What We Offer
      </p>

      {/* Headline */}
      <h2
        className="text-4xl md:text-5xl text-white mb-4"
        style={{ fontFamily: "var(--font-bungee)", letterSpacing: "0.03em" }}
      >
        Our Services
      </h2>

      {/* Subtitle */}
      <p
        className="text-sm md:text-base leading-relaxed max-w-sm mx-auto"
        style={{ fontFamily: "var(--font-inter)", color: "rgba(255,255,255,0.45)" }}
      >
        Every cut is a craft. Every visit is an experience.
      </p>

      {/* Gold accent line centred under title */}
      <div className="flex justify-center mt-6">
        <div
          className="h-px w-16 rounded-full"
          style={{
            background: "linear-gradient(to right, transparent, #CA8A04, #F0C040, transparent)",
          }}
        />
      </div>
    </motion.div>
  );
}

// ── Service Card ──────────────────────────────────────────────────────────────

type CardProps = {
  service: (typeof SERVICES)[number];
};

function ServiceCard({ service }: CardProps) {
  const isPopular = !!service.badge;

  return (
    <motion.article
      variants={staggerItem}
      className={`
        service-card relative flex flex-col rounded-2xl p-6 gap-5
        ${isPopular
          ? "border border-[rgba(212,160,23,0.38)] hover:border-[rgba(240,192,64,0.6)]"
          : "border border-[rgba(255,255,255,0.07)] hover:border-[rgba(212,160,23,0.3)]"
        }
      `}
      style={{
        background: isPopular
          ? "rgba(22, 15, 4, 0.72)"
          : "rgba(10, 10, 10, 0.62)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        boxShadow: isPopular
          ? "0 0 32px rgba(212,160,23,0.08), 0 4px 24px rgba(0,0,0,0.45)"
          : "0 4px 20px rgba(0,0,0,0.35)",
      }}
    >
      {/* ── Popular badge ── */}
      {isPopular && (
        <div
          className="absolute -top-3.5 left-1/2 -translate-x-1/2
            px-4 py-1 rounded-full text-[9px] tracking-[0.25em] uppercase font-semibold
            whitespace-nowrap"
          style={{
            fontFamily: "var(--font-source-code-pro)",
            background: "linear-gradient(135deg, #B45309, #CA8A04, #D4A017, #F0C040)",
            color: "#0A0A0A",
            boxShadow: "0 0 16px rgba(212,160,23,0.45)",
          }}
        >
          {service.badge}
        </div>
      )}

      {/* ── Service name ── */}
      <h3
        className="text-lg md:text-xl text-white leading-tight"
        style={{ fontFamily: "var(--font-bungee)", letterSpacing: "0.03em" }}
      >
        {service.name}
      </h3>

      {/* ── Price ── */}
      <span
        className="text-[2.25rem] leading-none text-gold-gradient"
        style={{ fontFamily: "var(--font-bungee)" }}
      >
        {service.price}
      </span>

      {/* ── Description ── */}
      <p
        className="text-sm leading-[1.7] flex-1"
        style={{
          fontFamily: "var(--font-inter)",
          color: "rgba(255,255,255,0.58)",
        }}
      >
        {service.description}
      </p>

      {/* ── Divider ── */}
      <div
        className="h-px w-full shrink-0"
        style={{
          background: isPopular
            ? "rgba(212, 160, 23, 0.22)"
            : "rgba(255, 255, 255, 0.07)",
        }}
      />

      {/* ── Footer: duration + CTA ── */}
      <div className="flex items-center justify-between gap-3">

        {/* Duration badge */}
        <div className="flex items-center gap-1.5">
          <ClockIcon
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: "rgba(255,255,255,0.28)" }}
            aria-hidden="true"
          />
          <span
            className="text-[11px] tracking-wider"
            style={{
              fontFamily: "var(--font-source-code-pro)",
              color: "rgba(255,255,255,0.32)",
            }}
          >
            {service.duration}
          </span>
        </div>

        {/* Book CTA */}
        <Link
          href="#contact"
          aria-label={`Book ${service.name}`}
          className={`
            inline-flex items-center px-5 py-2.5 rounded-full
            text-[10px] tracking-[0.2em] uppercase cursor-pointer
            transition-all duration-200 min-h-[40px] shrink-0
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/50
            ${isPopular
              ? "btn-gold text-[#0A0A0A] font-semibold"
              : "border border-[rgba(255,255,255,0.12)] text-white/60 hover:border-[rgba(212,160,23,0.45)] hover:text-yellow-400"
            }
          `}
          style={{ fontFamily: "var(--font-source-code-pro)" }}
        >
          Book
        </Link>
      </div>
    </motion.article>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function ServicesSection() {
  return (
    <SectionWrapper
      id="services"
      className="relative"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(28,25,23,0.9) 0%, #0A0A0A 55%)",
      } as React.CSSProperties}
    >
      {/* Subtle top edge divider */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, rgba(212,160,23,0.18) 30%, rgba(212,160,23,0.18) 70%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto">
        <SectionHeader />

        {/* Cards grid — 3 cols desktop, 2 cols tablet, 1 col mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {SERVICES.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>

        {/* Bottom micro-copy */}
        <motion.p
          variants={staggerItem}
          className="text-center mt-10 text-[11px] tracking-widest uppercase"
          style={{
            fontFamily: "var(--font-source-code-pro)",
            color: "rgba(255,255,255,0.22)",
          }}
        >
          Walk-ins welcome · Appointments get priority
        </motion.p>
      </div>
    </SectionWrapper>
  );
}
