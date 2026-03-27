"use client";

import { motion, useReducedMotion } from "framer-motion";
import { staggerContainer } from "@/lib/animations";

interface SectionWrapperProps {
  /** Hash-navigation anchor id — matches href in NAV_LINKS */
  id: string;
  children: React.ReactNode;
  /** Extra Tailwind classes (e.g. override background, remove horizontal padding) */
  className?: string;
  /** Inline styles (e.g. custom background gradient) */
  style?: React.CSSProperties;
  /**
   * How far the section must be inside the viewport before triggering.
   * Negative value = trigger before fully in view. Default: "-80px"
   */
  viewportMargin?: string;
}

/**
 * Reusable section wrapper.
 *
 * Responsibilities:
 *  - Applies consistent vertical + horizontal padding across every section
 *  - Anchors the id for smooth hash-link navigation
 *  - Triggers staggerContainer when the section scrolls into view (once)
 *
 * Usage:
 *   <SectionWrapper id="services">
 *     <motion.div variants={staggerItem}>...</motion.div>
 *   </SectionWrapper>
 */
export default function SectionWrapper({
  id,
  children,
  className = "",
  style,
  viewportMargin = "-80px",
}: SectionWrapperProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      variants={staggerContainer}
      initial={prefersReducedMotion ? "visible" : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: viewportMargin }}
      style={style}
      className={`
        relative
        py-20 md:py-28 lg:py-32
        px-6 sm:px-10 md:px-16 lg:px-24
        ${className}
      `.trim()}
    >
      {children}
    </motion.section>
  );
}
