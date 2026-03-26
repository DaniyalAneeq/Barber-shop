"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type TimelineItem = {
  id:         number;
  title:      string;
  date:       string;
  content:    string;
  category:   string;
  icon:       LucideIcon;
  relatedIds: number[];
  status:     "completed" | "in-progress" | "pending";
  energy:     number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusStyles(status: TimelineItem["status"]): React.CSSProperties {
  if (status === "completed")
    return { backgroundColor: "#D4A017", color: "#0A0A0A", border: "none" };
  if (status === "in-progress")
    return { backgroundColor: "transparent", color: "#D4A017", border: "1px solid rgba(212,160,23,0.5)" };
  return { backgroundColor: "transparent", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.15)" };
}

const ORBIT_DURATION = 28; // seconds per revolution
const COMET_DURATION = 7;  // comet moves ~4× faster

// ── Component ─────────────────────────────────────────────────────────────────
export function RadialOrbitalTimeline({ timelineData }: { timelineData: TimelineItem[] }) {
  const [activeId,  setActiveId]  = useState<number | null>(null);
  const [cardPos,   setCardPos]   = useState<{ left: number; top: number } | null>(null);
  const containerRef              = useRef<HTMLDivElement>(null);
  const [dims, setDims]           = useState({ w: 600, h: 600 });

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setDims({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sq     = Math.min(dims.w, dims.h);
  const cx     = dims.w / 2;
  const cy     = dims.h / 2;
  const radius = sq * 0.37;
  const cardW  = Math.min(242, dims.w - 40);
  const paused = activeId !== null;

  // Static node positions (CSS animation handles rotation visually)
  const getInitialPos = useCallback(
    (index: number) => {
      const angle = (index / timelineData.length) * 2 * Math.PI - Math.PI / 2;
      return {
        x:    cx + radius * Math.cos(angle),
        y:    cy + radius * Math.sin(angle),
        cosA: Math.cos(angle),
        sinA: Math.sin(angle),
      };
    },
    [cx, cy, radius, timelineData.length]
  );

  const activeItem = activeId !== null
    ? (timelineData.find((i) => i.id === activeId) ?? null) : null;

  const isRelated = (id: number) =>
    activeItem !== null && activeItem.relatedIds.includes(id);

  // On click — capture real visual position via getBoundingClientRect
  const handleNodeClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, id: number) => {
      e.stopPropagation();
      if (activeId === id) { setActiveId(null); setCardPos(null); return; }

      const rect          = e.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current!.getBoundingClientRect();
      const nx = rect.left + rect.width  / 2 - containerRect.left;
      const ny = rect.top  + rect.height / 2 - containerRect.top;

      // Pull card inward toward center from the real node position
      const dx   = cx - nx;
      const dy   = cy - ny;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = radius * 0.52;
      const cardH = 206;
      let left = nx + (dx / dist) * pull - cardW / 2;
      let top  = ny + (dy / dist) * pull - cardH / 2;
      left = Math.max(8, Math.min(dims.w - cardW - 8, left));
      top  = Math.max(8, Math.min(dims.h - cardH - 8, top));

      setActiveId(id);
      setCardPos({ left, top });
    },
    [activeId, cx, cy, radius, cardW, dims.w, dims.h]
  );

  const handleClose = useCallback(() => { setActiveId(null); setCardPos(null); }, []);

  // ── CSS animation helpers ─────────────────────────────────────────────────
  const spinStyle = (duration: number, extra?: React.CSSProperties): React.CSSProperties => ({
    animation:           `orbit-spin ${duration}s linear infinite`,
    animationPlayState:  paused ? "paused" : "running",
    ...extra,
  });

  // Counter-rotation keeps content upright despite parent spinning
  const counterSpinStyle: React.CSSProperties = {
    animation:          `orbit-spin ${ORBIT_DURATION}s linear infinite reverse`,
    animationPlayState: paused ? "paused" : "running",
    display:            "flex",
    alignItems:         "center",
    justifyContent:     "center",
    width:              "100%",
    height:             "100%",
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ backgroundColor: "#0A0A0A" }}
      onClick={handleClose}
    >
      {/* ── Soft radial glow behind center ── */}
      <div
        className="absolute pointer-events-none"
        style={{
          left:       cx - radius * 1.1,
          top:        cy - radius * 1.1,
          width:      radius * 2.2,
          height:     radius * 2.2,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,160,23,0.06) 0%, transparent 70%)",
        }}
      />

      {/* ── Rotating wrapper — carries orbit ring + all nodes ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={spinStyle(ORBIT_DURATION, { transformOrigin: `${cx}px ${cy}px` })}
      >
        {/* Orbit ring */}
        <div
          className="absolute rounded-full"
          style={{
            left:   cx - radius,
            top:    cy - radius,
            width:  radius * 2,
            height: radius * 2,
            border: "1px solid rgba(212,160,23,0.15)",
          }}
        />

        {/* Dashed accent ring (slightly inside) */}
        <div
          className="absolute rounded-full"
          style={{
            left:         cx - radius + 10,
            top:          cy - radius + 10,
            width:        (radius - 10) * 2,
            height:       (radius - 10) * 2,
            border:       "1px dashed rgba(212,160,23,0.06)",
            borderRadius: "50%",
          }}
        />

        {/* Nodes — pointer-events restored individually */}
        {timelineData.map((item, index) => {
          const { x, y, cosA, sinA } = getInitialPos(index);
          const isActive = activeId === item.id;
          const rel      = !isActive && isRelated(item.id);
          const Icon     = item.icon;

          // Label: outward from node
          const lGap   = 30;
          const lx     = x + cosA * lGap;
          const ly     = y + sinA * lGap;
          const anchor = cosA > 0.18 ? "left" : cosA < -0.18 ? "right" : "center";

          return (
            <React.Fragment key={item.id}>

              {/* Node button */}
              <button
                className="absolute rounded-full cursor-pointer focus:outline-none"
                style={{
                  left:            x,
                  top:             y,
                  width:           44,
                  height:          44,
                  transform:       "translate(-50%,-50%)",
                  zIndex:          isActive ? 30 : 20,
                  pointerEvents:   "auto",
                  transition:      "border-color 0.2s, background-color 0.2s, box-shadow 0.2s",
                  ...(isActive ? {
                    backgroundColor: "#D4A017",
                    border:          "1px solid #F0C040",
                    color:           "#0A0A0A",
                    boxShadow:       "0 0 28px rgba(212,160,23,0.6)",
                  } : rel ? {
                    backgroundColor: "rgba(212,160,23,0.2)",
                    border:          "1px solid #D4A017",
                    color:           "#D4A017",
                    animation:       "orbit-node-glow 1.6s ease-in-out infinite",
                    animationPlayState: paused ? "paused" : "running",
                  } : {
                    backgroundColor: "#0A0A0A",
                    border:          "1px solid rgba(212,160,23,0.4)",
                    color:           "#D4A017",
                  }),
                }}
                onClick={(e) => handleNodeClick(e, item.id)}
                aria-label={`${item.title} — ${item.date}`}
                aria-expanded={isActive}
              >
                {/* Counter-rotate so icon stays upright */}
                <div style={counterSpinStyle}>
                  <Icon size={17} aria-hidden="true" />
                </div>
              </button>

              {/* Label — also counter-rotated for readability */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left:  lx,
                  top:   ly,
                  zIndex: 10,
                  ...counterSpinStyle,
                  display:       "block",
                  width:         "auto",
                  height:        "auto",
                  transform:
                    anchor === "left"
                      ? "translateY(-50%)"
                      : anchor === "right"
                      ? "translate(-100%,-50%)"
                      : "translate(-50%, 9px)",
                  fontFamily:    "'Source Code Pro', monospace",
                  fontSize:      "9px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  whiteSpace:    "nowrap",
                  color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
                }}
              >
                {item.title}
              </div>

            </React.Fragment>
          );
        })}
      </div>

      {/* ── Fast-moving comet — orbits at 4× the speed ── */}
      <div
        className="pointer-events-none absolute"
        style={spinStyle(COMET_DURATION, {
          left:            cx,
          top:             cy - radius,
          width:           0,
          height:          0,
          transformOrigin: "0px 0px",
        })}
      >
        {/* Comet body */}
        <div
          style={{
            position:        "absolute",
            left:            -4,
            top:             -4,
            width:           8,
            height:          8,
            borderRadius:    "50%",
            background:      "radial-gradient(circle, #F0C040 0%, #D4A017 60%, transparent 100%)",
            boxShadow:       "0 0 10px 3px rgba(240,192,64,0.65)",
          }}
        />
        {/* Comet tail — blur streak behind */}
        <div
          style={{
            position:   "absolute",
            left:       -2,
            top:        3,
            width:      3,
            height:     18,
            borderRadius: "0 0 4px 4px",
            background: "linear-gradient(to bottom, rgba(240,192,64,0.55), transparent)",
            transform:  "rotate(0deg)",
          }}
        />
      </div>

      {/* ── Center orb ── */}
      <div
        className="absolute pointer-events-none"
        style={{ left: cx - 28, top: cy - 28, width: 56, height: 56 }}
      >
        {/* Expanding halo ring — purely decorative */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border:    "1px solid rgba(212,160,23,0.45)",
            animation: "orbit-pulse-ring 2.6s ease-out infinite",
          }}
        />
        {/* Second halo, offset phase */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border:           "1px solid rgba(212,160,23,0.25)",
            animation:        "orbit-pulse-ring 2.6s ease-out infinite",
            animationDelay:   "1.3s",
          }}
        />
        {/* Orb itself */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(135deg, #92400E, #D4A017, #F0C040)",
            animation:  "orbit-orb-breathe 3s ease-in-out infinite",
          }}
        >
          {/* Inner white dot */}
          <div
            className="absolute rounded-full"
            style={{
              left:            "50%",
              top:             "50%",
              transform:       "translate(-50%,-50%)",
              width:           10,
              height:          10,
              backgroundColor: "rgba(255,255,255,0.92)",
            }}
          />
        </div>
      </div>

      {/* ── Card popup — outside rotating wrapper, uses frozen click position ── */}
      <AnimatePresence>
        {activeItem && cardPos && (() => {
          const st = statusStyles(activeItem.status);
          return (
            <motion.div
              key={`card-${activeItem.id}`}
              initial={{ opacity: 0, scale: 0.86, y: 6 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{    opacity: 0, scale: 0.86, y: 6 }}
              transition={{ duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute rounded-xl p-4"
              style={{
                left:            cardPos.left,
                top:             cardPos.top,
                width:           cardW,
                zIndex:          40,
                backgroundColor: "rgba(10,10,10,0.96)",
                border:          "1px solid rgba(212,160,23,0.22)",
                backdropFilter:  "blur(24px)",
                boxShadow:       "0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(212,160,23,0.06)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gold accent top bar */}
              <div
                className="absolute top-0 left-6 right-6 h-px"
                style={{ background: "linear-gradient(to right, transparent, rgba(212,160,23,0.4), transparent)" }}
              />

              {/* Date */}
              <p style={{ fontFamily: "'Source Code Pro', monospace", color: "rgba(212,160,23,0.7)", fontSize: "11px", letterSpacing: "0.12em", marginBottom: "4px" }}>
                {activeItem.date}
              </p>

              {/* Title */}
              <h3 style={{ fontFamily: "'Bungee', cursive", color: "white", fontSize: "15px", letterSpacing: "0.04em", lineHeight: 1.2, marginBottom: "8px" }}>
                {activeItem.title}
              </h3>

              {/* Content */}
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.57)", fontSize: "12px", lineHeight: 1.65, marginBottom: "10px" }}>
                {activeItem.content}
              </p>

              {/* Status + Category */}
              <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: "10px" }}>
                <span className="rounded-full px-2 py-0.5" style={{ fontFamily: "'Source Code Pro', monospace", fontSize: "9px", letterSpacing: "0.07em", textTransform: "uppercase", ...st }}>
                  {activeItem.status}
                </span>
                <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: "9px", letterSpacing: "0.05em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                  {activeItem.category}
                </span>
              </div>

              {/* Energy bar */}
              <div>
                <div className="flex justify-between" style={{ marginBottom: "4px" }}>
                  <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>Energy</span>
                  <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: "8px", color: "rgba(212,160,23,0.7)" }}>{activeItem.energy}%</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 3, backgroundColor: "rgba(255,255,255,0.07)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${activeItem.energy}%` }}
                    transition={{ duration: 0.65, ease: "easeOut", delay: 0.1 }}
                    style={{ background: "linear-gradient(to right, #92400E, #D4A017, #F0C040)" }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
