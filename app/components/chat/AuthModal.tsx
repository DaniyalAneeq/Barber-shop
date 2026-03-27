"use client";

/**
 * Step 1 — Collect user's name + email before sending verification code.
 * Matches the site's dark/gold aesthetic.
 */

import { FormEvent, useState } from "react";
import type { SendStatus } from "./types";

interface Props {
  onSubmit: (email: string, name: string) => void;
  status: SendStatus;
  error: string | null;
  onClearError: () => void;
}

export default function AuthModal({ onSubmit, status, error, onClearError }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const isLoading = status === "sending";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    onSubmit(email.trim(), name.trim());
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="text-center pb-1">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mx-auto mb-3"
          style={{
            background: "linear-gradient(135deg, #92400E, #F0C040)",
          }}
        >
          ✂
        </div>
        <h2
          className="text-lg font-bold tracking-wide"
          style={{ fontFamily: "var(--font-bungee)", color: "#F0C040" }}
        >
          Meet Blade
        </h2>
        <p className="text-xs text-white/50 mt-1">
          Your AI barbershop assistant. Enter your details to start chatting.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="text-xs px-3 py-2.5 rounded-lg flex items-start gap-2"
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
          }}
        >
          <span className="mt-0.5 flex-shrink-0">⚠</span>
          <span className="flex-1">{error}</span>
          <button
            onClick={onClearError}
            className="flex-shrink-0 opacity-60 hover:opacity-100 ml-1"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label
            htmlFor="bs-name"
            className="block text-[10px] font-semibold tracking-widest uppercase mb-1.5"
            style={{ color: "#CA8A04", fontFamily: "var(--font-source-code-pro)" }}
          >
            Your Name
          </label>
          <input
            id="bs-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marcus"
            autoFocus
            autoComplete="given-name"
            disabled={isLoading}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontFamily: "var(--font-inter)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.border = "1px solid rgba(202,138,4,0.6)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)")
            }
          />
        </div>

        <div>
          <label
            htmlFor="bs-email"
            className="block text-[10px] font-semibold tracking-widest uppercase mb-1.5"
            style={{ color: "#CA8A04", fontFamily: "var(--font-source-code-pro)" }}
          >
            Email Address
          </label>
          <input
            id="bs-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isLoading}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontFamily: "var(--font-inter)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.border = "1px solid rgba(202,138,4,0.6)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)")
            }
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !email.trim() || !name.trim()}
          className="btn-gold mt-1 w-full py-2.5 rounded-xl text-sm font-bold tracking-wider text-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all"
          style={{ fontFamily: "var(--font-source-code-pro)" }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full border-2 border-[#0A0A0A]/30 border-t-[#0A0A0A] inline-block"
                style={{ animation: "spin 0.7s linear infinite" }}
              />
              Sending code…
            </span>
          ) : (
            "Send Verification Code →"
          )}
        </button>
      </form>

      <p className="text-[10px] text-white/30 text-center">
        We'll send a 6-digit code to verify your email.
        <br />
        No spam, ever.
      </p>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
