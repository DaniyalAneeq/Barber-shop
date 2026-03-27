"use client";

/**
 * Three-dot typing animation — gold pulsing dots with staggered timing.
 * Displayed while waiting for AI response.
 */

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-2 h-2 rounded-full bg-gold"
          style={{
            animation: "bs-bounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes bs-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
