"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScissorsIcon, Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { NAV_LINKS } from "@/data/content";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed top-4 left-4 right-4 z-50"
    >
      {/* ── Main bar ── */}
      <div className="glass-nav max-w-7xl mx-auto flex items-center justify-between px-5 py-3.5 rounded-2xl">

        {/* Logo */}
        <Link
          href="#home"
          className="flex items-center gap-2.5 cursor-pointer group"
          aria-label="Barber Shop — home"
        >
          <div
            className="p-1.5 rounded-lg transition-colors duration-200 group-hover:bg-yellow-500/20"
            style={{
              background: "rgba(202,138,4,0.12)",
              border: "1px solid rgba(202,138,4,0.3)",
            }}
          >
            <ScissorsIcon
              className="w-5 h-5 text-yellow-500 transition-transform duration-300 group-hover:rotate-12"
              aria-hidden="true"
            />
          </div>
          <span
            className="text-white font-semibold text-sm tracking-widest uppercase"
            style={{ fontFamily: "var(--font-source-code-pro)" }}
          >
            Barber Shop
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="relative text-white/60 hover:text-white text-sm tracking-wider
                transition-colors duration-200 cursor-pointer group pb-0.5"
              style={{ fontFamily: "var(--font-source-code-pro)" }}
            >
              {label}
              {/* Underline reveal */}
              <span
                className="absolute bottom-0 left-0 right-0 h-px scale-x-0
                  group-hover:scale-x-100 transition-transform duration-200 origin-left"
                style={{ background: "rgba(212,160,23,0.8)" }}
              />
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <button
          className="hidden md:inline-flex items-center px-5 py-2 rounded-full
            text-xs tracking-widest uppercase cursor-pointer text-yellow-400
            border transition-all duration-200
            hover:text-yellow-300 hover:bg-yellow-500/10"
          style={{
            fontFamily: "var(--font-source-code-pro)",
            borderColor: "rgba(202,138,4,0.4)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = "rgba(240,192,64,0.65)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "rgba(202,138,4,0.4)")
          }
        >
          Book Now
        </button>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden text-white/70 hover:text-white transition-colors duration-200 cursor-pointer p-1"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? (
            <XMarkIcon className="w-6 h-6" aria-hidden="true" />
          ) : (
            <Bars3Icon className="w-6 h-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scaleY: 0.94 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.94 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="glass-nav max-w-7xl mx-auto mt-2 rounded-2xl px-5 py-4 origin-top"
          >
            <nav
              className="flex flex-col gap-0"
              style={{ fontFamily: "var(--font-source-code-pro)" }}
              aria-label="Mobile navigation"
            >
              {NAV_LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="text-white/65 hover:text-white py-3 px-2 text-sm tracking-widest uppercase
                    border-b border-white/5 last:border-0 transition-colors duration-150 cursor-pointer"
                >
                  {label}
                </Link>
              ))}
              <button
                className="mt-3 w-full py-3 rounded-full text-xs font-medium tracking-widest uppercase
                  cursor-pointer border border-yellow-600/40 text-yellow-400
                  hover:bg-yellow-500/10 transition-colors duration-200"
              >
                Book Now
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
