"use client";

/**
 * Chat message bubble — user (right, gold) or assistant (left, dark).
 * - Relative timestamps (just now, 2m ago, etc.)
 * - Streaming cursor animation
 * - Error state with red tint
 */

import type { ChatMessage } from "./types";
import TypingIndicator from "./TypingIndicator";

interface Props {
  message: ChatMessage;
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Message({ message }: Props) {
  const isUser = message.role === "user";

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
        {/* Bubble */}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
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
                  background: message.isError
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(255,255,255,0.06)",
                  border: message.isError
                    ? "1px solid rgba(239,68,68,0.3)"
                    : "1px solid rgba(255,255,255,0.08)",
                }
          }
        >
          {/* Show typing indicator only when streaming AND no content yet */}
          {message.isStreaming && message.content === "" ? (
            <TypingIndicator />
          ) : (
            <>
              <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {message.content}
              </span>
              {/* Blinking cursor while streaming */}
              {message.isStreaming && (
                <span
                  className="inline-block w-0.5 h-4 bg-gold ml-0.5 align-middle"
                  style={{ animation: "bs-cursor 0.8s step-end infinite" }}
                />
              )}
            </>
          )}
        </div>

        {/* Timestamp */}
        {!message.isStreaming && (
          <span className="text-[10px] text-white/25 px-1">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>

      <style jsx>{`
        @keyframes bs-cursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
