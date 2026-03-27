"use client";

/**
 * Floating robot/scissor button (bottom-right).
 * - Pulsing ring animation on idle
 * - Unread badge when messages arrive while closed
 * - Rotates to X when chat is open
 */

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  isOpen: boolean;
  unreadCount: number;
  onClick: () => void;
}

export default function FloatingButton({ isOpen, unreadCount, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? "Close chat" : "Open chat assistant"}
      className="relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
      style={{ width: 56, height: 56 }}
    >
      {/* Pulsing ring (only when closed) */}
      {!isOpen && (
        <>
          <span
            className="absolute inset-0 rounded-full opacity-40"
            style={{
              background: "rgba(202,138,4,0.3)",
              animation: "bs-ring 2s ease-out infinite",
            }}
          />
          <span
            className="absolute inset-0 rounded-full opacity-20"
            style={{
              background: "rgba(202,138,4,0.2)",
              animation: "bs-ring 2s ease-out infinite 0.5s",
            }}
          />
        </>
      )}

      {/* Main button */}
      <motion.div
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center shadow-xl"
        style={{
          background: isOpen
            ? "#1C1917"
            : "linear-gradient(135deg, #92400E 0%, #B45309 20%, #CA8A04 50%, #D4A017 75%, #F0C040 100%)",
          border: isOpen ? "2px solid rgba(202,138,4,0.4)" : "none",
          boxShadow: isOpen
            ? "0 4px 24px rgba(0,0,0,0.6)"
            : "0 0 30px rgba(212,160,23,0.4), 0 8px 28px rgba(0,0,0,0.6)",
        }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.svg
              key="close"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15 }}
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#CA8A04"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </motion.svg>
          ) : (
            <motion.span
              key="icon"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15 }}
              style={{ fontSize: 22, color: "#0A0A0A", lineHeight: 1 }}
              aria-hidden="true"
            >
              ✂
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Unread badge */}
      <AnimatePresence>
        {unreadCount > 0 && !isOpen && (
          <motion.span
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="absolute -top-1 -right-1 z-20 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: "#EF4444", color: "#fff" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes bs-ring {
          0%   { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </button>
  );
}
