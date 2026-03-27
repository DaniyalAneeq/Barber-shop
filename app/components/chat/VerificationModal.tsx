"use client";

/**
 * Step 2 — 6-digit verification code input.
 * - Individual digit boxes with auto-focus
 * - Paste detection (pastes all 6 digits at once)
 * - Keyboard navigation (backspace moves to previous box)
 * - Resend with 60s countdown
 */

import { ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import type { SendStatus } from "./types";

interface Props {
  email: string;
  onVerify: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
  status: SendStatus;
  error: string | null;
  onClearError: () => void;
}

const COOLDOWN = 60;

export default function VerificationModal({
  email,
  onVerify,
  onResend,
  onBack,
  status,
  error,
  onClearError,
}: Props) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [cooldown, setCooldown] = useState(COOLDOWN);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const isLoading = status === "sending";

  // Start cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    const code = digits.join("");
    if (code.length === 6 && /^\d{6}$/.test(code) && !isLoading) {
      onVerify(code);
    }
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus first input on mount
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    const ch = value.replace(/\D/g, "").slice(-1); // digits only
    const next = [...digits];
    next[index] = ch;
    setDigits(next);
    if (ch && index < 5) {
      refs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (digits[index]) {
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        next[index - 1] = "";
        setDigits(next);
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    refs.current[focusIdx]?.focus();
  }

  function handleResend() {
    if (cooldown > 0) return;
    onResend();
    setCooldown(COOLDOWN);
    setDigits(Array(6).fill(""));
    refs.current[0]?.focus();
  }

  const maskedEmail = email.replace(/(.{2}).+(@.+)/, "$1***$2");

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="text-[11px] text-white/40 hover:text-white/70 flex items-center gap-1 mb-3 transition-colors"
          disabled={isLoading}
        >
          ← Back
        </button>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg mx-auto mb-3"
          style={{ background: "rgba(202,138,4,0.15)", border: "1px solid rgba(202,138,4,0.3)" }}
        >
          ✉
        </div>
        <h2
          className="text-center text-base font-bold tracking-wide"
          style={{ fontFamily: "var(--font-bungee)", color: "#F0C040" }}
        >
          Check Your Email
        </h2>
        <p className="text-[11px] text-white/50 text-center mt-1">
          We sent a 6-digit code to{" "}
          <span className="text-white/80">{maskedEmail}</span>
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
          <button onClick={onClearError} className="flex-shrink-0 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Digit inputs */}
      <div className="flex gap-2 justify-center" role="group" aria-label="Verification code">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={isLoading}
            aria-label={`Digit ${i + 1}`}
            className="w-10 h-12 text-center text-lg font-bold rounded-xl outline-none transition-all duration-150 disabled:opacity-50"
            style={{
              background: digit ? "rgba(202,138,4,0.15)" : "rgba(255,255,255,0.05)",
              border: digit
                ? "1.5px solid rgba(202,138,4,0.7)"
                : "1.5px solid rgba(255,255,255,0.1)",
              color: digit ? "#F0C040" : "#fff",
              fontFamily: "var(--font-source-code-pro)",
              letterSpacing: "0.1em",
            }}
          />
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-xs text-white/50">
          <span
            className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-gold inline-block"
            style={{ animation: "spin 0.7s linear infinite" }}
          />
          Verifying…
        </div>
      )}

      {/* Resend */}
      <div className="text-center text-[11px]">
        {cooldown > 0 ? (
          <span className="text-white/30">
            Resend available in{" "}
            <span style={{ color: "#CA8A04" }}>{cooldown}s</span>
          </span>
        ) : (
          <button
            onClick={handleResend}
            className="transition-colors"
            style={{ color: "#CA8A04" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#F0C040")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#CA8A04")}
          >
            Didn't receive it? Resend code
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
