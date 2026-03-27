"use client";

/**
 * Chat message bubble — user (right, gold) or assistant (left, dark).
 * - Relative timestamps (just now, 2m ago, etc.)
 * - Streaming cursor animation
 * - Error state with red tint
 * - Markdown rendering for assistant messages (bold, lists, headings)
 * - Clickable time-slot chips when agent presents booking options
 * - Highlighted styling for booking confirmations
 */

import type { ReactNode } from "react";
import type { ChatMessage } from "./types";
import TypingIndicator from "./TypingIndicator";

interface Props {
  message: ChatMessage;
  onSend?: (text: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Detect if the message text is a booking confirmation. */
function isBookingConfirmation(content: string): boolean {
  return /\b(confirmed|successfully\s+booked|appointment\s+(has\s+been\s+)?(booked|confirmed))\b/i.test(
    content,
  );
}

/**
 * Extract bookable time strings from the message if there are enough of them
 * to be worth showing as one-click chips.
 */
function extractTimeSlots(content: string): string[] {
  // Only activate when the text is clearly presenting available booking times
  const hasSlotContext =
    /\b(available|slot|open\s+time|choose\s+a\s+time|select\s+a\s+time|pick\s+a\s+time)\b/i.test(
      content,
    );
  if (!hasSlotContext) return [];

  const raw = content.match(/\b\d{1,2}:\d{2}(?:\s*[AP]M)?\b/gi) ?? [];
  const unique = [...new Set(raw.map((t) => t.replace(/\s+/g, " ").trim()))];
  // Only worth showing as chips if there are 4+ distinct times
  return unique.length >= 4 ? unique.slice(0, 12) : [];
}

// ── Inline markdown (bold / italic) ──────────────────────────────────────────

function renderInline(text: string): ReactNode {
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
  if (segments.length === 1) return text;
  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return (
        <strong key={i} style={{ color: "#F0C040", fontWeight: 600 }}>
          {seg.slice(2, -2)}
        </strong>
      );
    }
    if (seg.startsWith("*") && seg.endsWith("*")) {
      return <em key={i}>{seg.slice(1, -1)}</em>;
    }
    return seg;
  });
}

// ── Block markdown (paragraphs / lists / headings) ────────────────────────────

function renderMarkdown(content: string): ReactNode[] {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.trim() === "") {
      if (nodes.length > 0) nodes.push(<div key={key++} className="h-1" />);
      continue;
    }

    // ## or # heading
    if (line.startsWith("## ") || line.startsWith("# ")) {
      const text = line.startsWith("## ") ? line.slice(3) : line.slice(2);
      nodes.push(
        <p
          key={key++}
          className="font-semibold mt-0.5"
          style={{ color: "#F0C040", fontSize: "0.78rem" }}
        >
          {renderInline(text)}
        </p>,
      );
      continue;
    }

    // Bullet list item (- or •)
    const bulletMatch = line.match(/^[-•]\s(.+)/);
    if (bulletMatch) {
      nodes.push(
        <div key={key++} className="flex gap-1.5 leading-relaxed">
          <span style={{ color: "rgba(240,192,64,0.7)", flexShrink: 0 }}>
            •
          </span>
          <span>{renderInline(bulletMatch[1])}</span>
        </div>,
      );
      continue;
    }

    // Numbered list item
    const numMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      nodes.push(
        <div key={key++} className="flex gap-1.5 leading-relaxed">
          <span
            style={{
              color: "rgba(240,192,64,0.7)",
              flexShrink: 0,
              minWidth: "1.2em",
            }}
          >
            {numMatch[1]}.
          </span>
          <span>{renderInline(numMatch[2])}</span>
        </div>,
      );
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={key++} className="leading-relaxed">
        {renderInline(line)}
      </p>,
    );
  }

  return nodes;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Message({ message, onSend }: Props) {
  const isUser = message.role === "user";
  const isConfirmation =
    !isUser && !message.isStreaming && isBookingConfirmation(message.content);
  const slots =
    !isUser && !message.isStreaming && !message.isError && onSend
      ? extractTimeSlots(message.content)
      : [];

  return (
    <div
      className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"} mb-3`}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-1"
          style={{
            background: "linear-gradient(135deg, #92400E 0%, #F0C040 100%)",
            color: "#0A0A0A",
          }}
          aria-label="AI assistant"
        >
          ✂
        </div>
      )}

      <div
        className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}
      >
        {/* Booking confirmation badge */}
        {isConfirmation && (
          <div
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(202,138,4,0.15)",
              border: "1px solid rgba(202,138,4,0.4)",
              color: "#D4A017",
            }}
          >
            ✓ Appointment Confirmed
          </div>
        )}

        {/* Bubble */}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm ${
            isUser
              ? "rounded-tr-sm text-[#0A0A0A] font-medium"
              : `rounded-tl-sm text-white/90 ${message.isError ? "border border-red-500/30" : ""}`
          }`}
          style={
            isUser
              ? {
                  background:
                    "linear-gradient(135deg, #92400E 0%, #B45309 30%, #CA8A04 60%, #D4A017 100%)",
                  boxShadow: "0 2px 12px rgba(212,160,23,0.25)",
                }
              : {
                  background: isConfirmation
                    ? "rgba(202,138,4,0.08)"
                    : message.isError
                      ? "rgba(239,68,68,0.12)"
                      : "rgba(255,255,255,0.06)",
                  border: isConfirmation
                    ? "1px solid rgba(202,138,4,0.35)"
                    : message.isError
                      ? "1px solid rgba(239,68,68,0.3)"
                      : "1px solid rgba(255,255,255,0.08)",
                }
          }
        >
          {message.isStreaming && message.content === "" ? (
            <TypingIndicator />
          ) : isUser ? (
            <>
              <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {message.content}
              </span>
              {message.isStreaming && (
                <span
                  className="inline-block w-0.5 h-4 bg-gold ml-0.5 align-middle"
                  style={{ animation: "bs-cursor 0.8s step-end infinite" }}
                />
              )}
            </>
          ) : (
            <div className="space-y-0.5" style={{ wordBreak: "break-word" }}>
              {renderMarkdown(message.content)}
              {message.isStreaming && (
                <span
                  className="inline-block w-0.5 h-4 ml-0.5 align-middle"
                  style={{
                    background: "#F0C040",
                    animation: "bs-cursor 0.8s step-end infinite",
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Time-slot chips — only after the message is fully received */}
        {slots.length > 0 && (
          <div className="flex flex-wrap gap-1 pl-0.5 mt-0.5">
            {slots.map((slot) => (
              <button
                key={slot}
                onClick={() => onSend!(slot)}
                className="text-[10px] px-2 py-1 rounded-md transition-all"
                style={{
                  background: "rgba(202,138,4,0.12)",
                  border: "1px solid rgba(202,138,4,0.3)",
                  color: "#D4A017",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(202,138,4,0.22)";
                  e.currentTarget.style.borderColor = "rgba(202,138,4,0.6)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(202,138,4,0.12)";
                  e.currentTarget.style.borderColor = "rgba(202,138,4,0.3)";
                }}
              >
                {slot}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {!message.isStreaming && (
          <span className="text-[10px] text-white/25 px-1">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>

      <style jsx>{`
        @keyframes bs-cursor {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
