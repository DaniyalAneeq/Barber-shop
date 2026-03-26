import type { Variants } from "framer-motion";

/** Shared cubic-bezier — premium ease-out feel */
export const EASE_OUT = [0.25, 0.46, 0.45, 0.94] as const;

// ─────────────────────────────────────────────────────────────
// Entrance variants
// ─────────────────────────────────────────────────────────────

/**
 * Fade up from below.
 * Primary entrance animation used across all sections.
 * @param delay  seconds before the animation starts
 * @param duration  total duration in seconds
 */
export function fadeUp(delay = 0, duration = 0.9): Variants {
  return {
    hidden: { opacity: 0, y: 38 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration, ease: EASE_OUT, delay },
    },
  };
}

/**
 * Simple opacity reveal — no movement.
 * Good for backgrounds, images, and decorative elements.
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.7, ease: "easeOut" },
  },
};

/**
 * Slide in from the left.
 * Used for gallery items and left-anchored feature lists.
 */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -52 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.75, ease: EASE_OUT },
  },
};

/**
 * Slide in from the right.
 * Pairs with slideInLeft for two-column layouts.
 */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 52 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.75, ease: EASE_OUT },
  },
};

// ─────────────────────────────────────────────────────────────
// Container + child variants (stagger pattern)
// ─────────────────────────────────────────────────────────────

/**
 * Stagger container — orchestrates children sequentially.
 * Wrap a list of `staggerItem` elements with this on the parent.
 * `delayChildren` gives the section time to enter the viewport first.
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

/**
 * Stagger item — child of staggerContainer.
 * Inherits timing from the parent; no manual delay needed.
 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE_OUT },
  },
};

/**
 * Scale-up pop — for cards, badges, and icons.
 */
export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: EASE_OUT },
  },
};
