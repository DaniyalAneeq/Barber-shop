"use client";

import { motion } from "framer-motion";
import {
  Scissors,
  Users,
  MapPin,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import SectionWrapper from "@/app/components/SectionWrapper";
import {
  RadialOrbitalTimeline,
  type TimelineItem,
} from "@/app/components/ui/radial-orbital-timeline";
import { staggerItem } from "@/lib/animations";

// ── Journey milestones ────────────────────────────────────────────────────────
const journeyData: TimelineItem[] = [
  {
    id:         1,
    title:      "Founded",
    date:       "2014",
    content:
      "Opened our first chair with one barber, one vision — precision cuts for the modern man.",
    category:   "Milestone",
    icon:       Scissors,
    relatedIds: [2],
    status:     "completed",
    energy:     100,
  },
  {
    id:         2,
    title:      "First Team",
    date:       "2016",
    content:
      "Grew to a team of four master barbers. Walk-ins tripled within the first year.",
    category:   "Growth",
    icon:       Users,
    relatedIds: [1, 3],
    status:     "completed",
    energy:     85,
  },
  {
    id:         3,
    title:      "New Location",
    date:       "2018",
    content:
      "Moved to our flagship location downtown. Expanded services to include hot towel shaves.",
    category:   "Expansion",
    icon:       MapPin,
    relatedIds: [2, 4],
    status:     "completed",
    energy:     90,
  },
  {
    id:         4,
    title:      "5K Clients",
    date:       "2020",
    content:
      "Reached 5,000 happy clients and a 4.9-star average rating across all platforms.",
    category:   "Achievement",
    icon:       Star,
    relatedIds: [3, 5],
    status:     "completed",
    energy:     75,
  },
  {
    id:         5,
    title:      "Awards",
    date:       "2022",
    content:
      "Named Best Barbershop in the city two years running by local lifestyle magazine.",
    category:   "Recognition",
    icon:       Trophy,
    relatedIds: [4, 6],
    status:     "completed",
    energy:     95,
  },
  {
    id:         6,
    title:      "What's Next",
    date:       "2025",
    content:
      "Expanding our grooming line and training the next generation of master barbers.",
    category:   "Future",
    icon:       Zap,
    relatedIds: [5],
    status:     "in-progress",
    energy:     60,
  },
];

// ── Section ───────────────────────────────────────────────────────────────────
export default function JourneySection() {
  return (
    <SectionWrapper
      id="journey"
      style={
        {
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(28,25,23,0.5) 0%, #0A0A0A 65%)",
        } as React.CSSProperties
      }
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
        <motion.div variants={staggerItem} className="text-center mb-10">
          <p
            style={{
              fontFamily:    "'Source Code Pro', monospace",
              fontSize:      "10px",
              letterSpacing: "0.35em",
              color:         "#D4A017",
              textTransform: "uppercase",
              marginBottom:  "16px",
            }}
          >
            // OUR JOURNEY
          </p>

          <h2
            className="text-3xl md:text-4xl lg:text-5xl text-white mb-4"
            style={{
              fontFamily:    "'Bungee', cursive",
              letterSpacing: "0.03em",
              lineHeight:    1.1,
            }}
          >
            A Legacy of Sharp Cuts.
          </h2>

          <p
            className="text-sm md:text-base max-w-sm mx-auto leading-relaxed"
            style={{
              fontFamily: "'Inter', sans-serif",
              color:      "rgba(255,255,255,0.65)",
            }}
          >
            Every milestone sharpened our craft.
          </p>

          {/* Gold accent line */}
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

        {/* ── Orbital timeline ── */}
        <motion.div
          variants={staggerItem}
          className="w-full rounded-2xl overflow-hidden"
          style={{
            height: "600px",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <RadialOrbitalTimeline timelineData={journeyData} />
        </motion.div>

        {/* Hint */}
        <motion.p
          variants={staggerItem}
          className="text-center mt-4 text-xs"
          style={{
            fontFamily:    "'Source Code Pro', monospace",
            color:         "rgba(255,255,255,0.22)",
            letterSpacing: "0.1em",
          }}
        >
          Click any node to explore
        </motion.p>

      </div>
    </SectionWrapper>
  );
}
