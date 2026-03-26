"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import Image from "next/image";
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import SectionWrapper from "./SectionWrapper";
import { staggerItem, EASE_OUT } from "@/lib/animations";
import { GALLERY } from "@/data/content";

// ── Local stagger — faster than global 0.12 s for a 6-item grid ──────────────
const galleryStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// ── Grid layout config ────────────────────────────────────────────────────────
// [rowSpan, colSpan] per item — applied only on lg screens via Tailwind classes.
// The CSS grid's `grid-auto-flow: row dense` fills gaps automatically.
const GRID_SPANS: [row: number, col: number][] = [
  [2, 1], // g1 — tall left
  [1, 1], // g2 — normal
  [1, 1], // g3 — normal
  [1, 1], // g4 — normal
  [2, 1], // g5 — tall right
  [1, 2], // g6 — wide bottom
];

// ── Lightbox ──────────────────────────────────────────────────────────────────

interface LightboxProps {
  activeIndex: number;
  direction: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

// Directional slide variants for image transitions
const slideVariants: Variants = {
  enter:  (d: number) => ({ opacity: 0, x: d * 70 }),
  center: { opacity: 1, x: 0 },
  exit:   (d: number) => ({ opacity: 0, x: d * -70 }),
};

function Lightbox({
  activeIndex,
  direction,
  onClose,
  onPrev,
  onNext,
}: LightboxProps) {
  const item    = GALLERY[activeIndex];
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // ── Keyboard: Escape + arrows ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowLeft")   onPrev();
      if (e.key === "ArrowRight")  onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  // ── Body scroll lock + initial focus ──
  useEffect(() => {
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ── Focus trap ──
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const els = Array.from(
        modal!.querySelectorAll<HTMLElement>(
          "button, [href], [tabindex]:not([tabindex='-1'])"
        )
      );
      const first = els[0];
      const last  = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    modal.addEventListener("keydown", trap);
    return () => modal.removeEventListener("keydown", trap);
  }, []);

  return (
    <motion.div
      ref={modalRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(4,4,4,0.94)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Gallery lightbox: ${item.alt}`}
      onClick={onClose}
    >
      {/* ── Modal panel — stops click-through ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.28, ease: [...EASE_OUT] as [number,number,number,number] }}
        className="relative w-full max-w-4xl mx-4 md:mx-12 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image stage */}
        <div className="relative w-full rounded-xl overflow-hidden"
          style={{ height: "70vh" }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activeIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.32, ease: [...EASE_OUT] as [number,number,number,number] }}
              className="absolute inset-0"
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                className="object-contain"
                sizes="(max-width: 1200px) 92vw, 900px"
                priority
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: label + counter */}
        <div className="flex items-center justify-between px-1">
          <p
            className="text-sm"
            style={{ fontFamily: "var(--font-inter)", color: "rgba(255,255,255,0.6)" }}
          >
            {item.label}
          </p>
          <p
            className="text-[11px] tracking-widest"
            style={{
              fontFamily: "var(--font-source-code-pro)",
              color: "rgba(212,160,23,0.7)",
            }}
          >
            {activeIndex + 1}&thinsp;/&thinsp;{GALLERY.length}
          </p>
        </div>
      </motion.div>

      {/* ── Nav: Prev ── */}
      <button
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2
          p-3 rounded-full cursor-pointer text-white/60 hover:text-white
          transition-all duration-200 hover:bg-white/10
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/50"
        aria-label="Previous image"
      >
        <ChevronLeftIcon className="w-7 h-7" aria-hidden="true" />
      </button>

      {/* ── Nav: Next ── */}
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2
          p-3 rounded-full cursor-pointer text-white/60 hover:text-white
          transition-all duration-200 hover:bg-white/10
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/50"
        aria-label="Next image"
      >
        <ChevronRightIcon className="w-7 h-7" aria-hidden="true" />
      </button>

      {/* ── Close ── */}
      <button
        ref={closeRef}
        onClick={onClose}
        className="absolute top-4 right-4 p-2.5 rounded-full cursor-pointer
          text-white/60 hover:text-white transition-all duration-200 hover:bg-white/10
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/50"
        aria-label="Close lightbox"
      >
        <XMarkIcon className="w-6 h-6" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

// ── Gallery grid item ─────────────────────────────────────────────────────────

interface GridItemProps {
  item:    (typeof GALLERY)[number];
  index:   number;
  rowSpan: number;
  colSpan: number;
  onOpen:  () => void;
}

function GridItem({ item, rowSpan, colSpan, onOpen }: GridItemProps) {
  // Mobile aspect ratios (overridden on lg by .gallery-grid > * { aspect-ratio: unset })
  const mobileAspect =
    rowSpan === 2 ? "aspect-[3/4]" :
    colSpan === 2 ? "aspect-video"  :
                    "aspect-square";

  return (
    <motion.button
      variants={staggerItem}
      onClick={onOpen}
      aria-label={`Open full-size: ${item.alt}`}
      className={`
        group relative overflow-hidden rounded-xl cursor-pointer
        ${mobileAspect}
        ${rowSpan === 2 ? "lg:row-span-2" : ""}
        ${colSpan === 2 ? "sm:col-span-2 lg:col-span-2" : ""}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/50
      `.trim()}
    >
      {/* ── Scaleable image layer ── */}
      <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.04]">
        <Image
          src={item.src}
          alt={item.alt}
          fill
          className="object-cover"
          sizes={`
            (max-width: 640px)  100vw,
            (max-width: 1024px) ${colSpan === 2 ? "100vw" : "50vw"},
            ${colSpan === 2 ? "66vw" : "33vw"}
          `}
        />
      </div>

      {/* ── Hover overlay ── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2
          bg-black/0 group-hover:bg-black/55 transition-colors duration-300"
      >
        {/* VIEW pill */}
        <span
          className="
            opacity-0 group-hover:opacity-100
            transition-opacity duration-200 delay-[60ms]
            text-[10px] tracking-[0.35em] uppercase
            px-4 py-2 rounded-full border text-yellow-400
          "
          style={{
            fontFamily: "var(--font-source-code-pro)",
            borderColor: "rgba(212,160,23,0.5)",
          }}
        >
          View
        </span>

        {/* Label */}
        {item.label && (
          <span
            className="
              opacity-0 group-hover:opacity-100
              transition-opacity duration-200 delay-100
              text-[11px] text-white/55
            "
            style={{ fontFamily: "var(--font-inter)" }}
          >
            {item.label}
          </span>
        )}
      </div>
    </motion.button>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function GallerySection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [direction,   setDirection]   = useState(1);
  const [mounted,     setMounted]     = useState(false);

  useEffect(() => setMounted(true), []);

  const isOpen  = activeIndex !== null;

  const open = useCallback((i: number) => {
    setDirection(1);
    setActiveIndex(i);
  }, []);

  const onClose = useCallback(() => setActiveIndex(null), []);

  const onNext = useCallback(() => {
    setDirection(1);
    setActiveIndex((i) => (i !== null ? (i + 1) % GALLERY.length : 0));
  }, []);

  const onPrev = useCallback(() => {
    setDirection(-1);
    setActiveIndex((i) =>
      i !== null ? (i - 1 + GALLERY.length) % GALLERY.length : GALLERY.length - 1
    );
  }, []);

  return (
    <>
      <SectionWrapper
        id="gallery"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(28,25,23,0.6) 0%, #0A0A0A 55%)",
        } as React.CSSProperties}
      >
        {/* Top edge divider */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(212,160,23,0.15) 30%, rgba(212,160,23,0.15) 70%, transparent 100%)",
          }}
          aria-hidden="true"
        />

        <div className="max-w-6xl mx-auto">

          {/* ── Section header ── */}
          <motion.div
            variants={staggerItem}
            className="text-center mb-12"
          >
            <p
              className="text-[11px] tracking-[0.35em] uppercase mb-4"
              style={{ fontFamily: "var(--font-source-code-pro)", color: "#CA8A04" }}
            >
              // Our Work
            </p>
            <h2
              className="text-4xl md:text-5xl text-white mb-4"
              style={{ fontFamily: "var(--font-bungee)", letterSpacing: "0.03em" }}
            >
              The Gallery
            </h2>
            <p
              className="text-sm md:text-base max-w-sm mx-auto leading-relaxed"
              style={{
                fontFamily: "var(--font-inter)",
                color: "rgba(255,255,255,0.42)",
              }}
            >
              Every cut tells a story. These are ours.
            </p>
            <div className="flex justify-center mt-6">
              <div
                className="h-px w-16 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, transparent, #CA8A04, #F0C040, transparent)",
                }}
              />
            </div>
          </motion.div>

          {/* ── Grid — nested stagger for faster per-card entry ── */}
          <motion.div
            variants={galleryStagger}
            className="gallery-grid"
          >
            {GALLERY.map((item, index) => {
              const [rowSpan, colSpan] = GRID_SPANS[index] ?? [1, 1];
              return (
                <GridItem
                  key={item.id}
                  item={item}
                  index={index}
                  rowSpan={rowSpan}
                  colSpan={colSpan}
                  onOpen={() => open(index)}
                />
              );
            })}
          </motion.div>

        </div>
      </SectionWrapper>

      {/* ── Lightbox portal ── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && activeIndex !== null && (
              <Lightbox
                activeIndex={activeIndex}
                direction={direction}
                onClose={onClose}
                onPrev={onPrev}
                onNext={onNext}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
