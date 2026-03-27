"use client";

/**
 * Chat window — message list + input bar + file attachment.
 * - Auto-scrolls to latest message (pauses when user scrolls up)
 * - Keyboard shortcut: Enter to send, Shift+Enter for newline
 * - Drag-and-drop file upload
 * - Optimistic message display
 * - "My Appointments" panel accessible from the header
 */

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ChatMessage, ChatUser, SendStatus, UploadedFile } from "./types";
import { type Appointment, getMyAppointments } from "@/lib/chatApi";
import Message from "./Message";

interface Props {
  user: ChatUser;
  messages: ChatMessage[];
  sendStatus: SendStatus;
  error: string | null;
  uploadedFile: UploadedFile | null;
  onSend: (text: string) => void;
  onFileUpload: (file: File) => void;
  onRemoveFile: () => void;
  onClearError: () => void;
  onLogout: () => void;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Date / time formatting for the appointments panel ─────────────────────────

function fmtApptDate(dateStr: string): string {
  // Append noon to avoid DST off-by-one-day issues
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtApptTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatWindow({
  user,
  messages,
  sendStatus,
  error,
  uploadedFile,
  onSend,
  onFileUpload,
  onRemoveFile,
  onClearError,
  onLogout,
}: Props) {
  const [input, setInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);

  // Appointments panel state
  const [showAppts, setShowAppts] = useState(false);
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [apptLoading, setApptLoading] = useState(false);
  const [apptError, setApptError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = sendStatus === "sending";

  // Auto-scroll to bottom when new messages arrive (if user is at bottom)
  useEffect(() => {
    if (isAtBottom && !showAppts) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom, showAppts]);

  // Track whether user has scrolled up
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 100;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    onSend(text);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function validateAndUpload(file: File) {
    setFileError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError("Only images (JPEG, PNG, WebP, GIF) and PDFs are supported.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setFileError("File is too large. Maximum size is 10MB.");
      return;
    }
    onFileUpload(file);
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndUpload(file);
    e.target.value = "";
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndUpload(file);
  }

  async function openAppointments() {
    setShowAppts(true);
    setApptLoading(true);
    setApptError(null);
    try {
      const data = await getMyAppointments(user.token);
      setAppts(data.appointments);
    } catch {
      setApptError("Could not load appointments. Please try again.");
    } finally {
      setApptLoading(false);
    }
  }

  function closeAppointments() {
    setShowAppts(false);
  }

  function bookViaChat() {
    setShowAppts(false);
    onSend("I'd like to book an appointment");
  }

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: "linear-gradient(135deg, #92400E, #F0C040)" }}
          >
            ✂
          </div>
          <div>
            <p
              className="text-xs font-bold tracking-wide leading-none"
              style={{ color: "#F0C040", fontFamily: "var(--font-bungee)" }}
            >
              Blade
            </p>
            <p className="text-[9px] text-white/40 mt-0.5">
              AI Barbershop Assistant
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Online indicator */}
          <span className="flex items-center gap-1 text-[9px] text-white/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Online
          </span>

          {/* My Appointments button */}
          <button
            onClick={showAppts ? closeAppointments : openAppointments}
            title="My Appointments"
            className="flex items-center justify-center w-6 h-6 rounded-md transition-all"
            style={{
              background: showAppts
                ? "rgba(202,138,4,0.25)"
                : "rgba(255,255,255,0.05)",
              border: showAppts
                ? "1px solid rgba(202,138,4,0.5)"
                : "1px solid rgba(255,255,255,0.08)",
              color: showAppts ? "#D4A017" : "rgba(255,255,255,0.35)",
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>

          {/* User name + logout */}
          <button
            onClick={onLogout}
            title="Sign out"
            className="text-[9px] text-white/30 hover:text-white/60 ml-1 transition-colors"
          >
            {user.name.split(" ")[0]} ↪
          </button>
        </div>
      </div>

      {/* ── Appointments panel ─────────────────────────────────────────────── */}
      {showAppts ? (
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#44403C #0A0A0A" }}>
          {/* Panel sub-header */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 sticky top-0"
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "#0F0F0F",
            }}
          >
            <button
              onClick={closeAppointments}
              className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
            >
              ← Back
            </button>
            <span
              className="text-[11px] font-semibold"
              style={{ color: "#D4A017" }}
            >
              My Appointments
            </span>
          </div>

          <div className="px-3 py-3">
            {/* Loading */}
            {apptLoading && (
              <div className="flex justify-center py-8">
                <span
                  className="w-5 h-5 rounded-full border-2 border-white/10 border-t-yellow-500 inline-block"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
              </div>
            )}

            {/* Error */}
            {apptError && !apptLoading && (
              <p className="text-xs text-red-400 text-center py-4">{apptError}</p>
            )}

            {/* Empty state */}
            {!apptLoading && !apptError && appts !== null && appts.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(202,138,4,0.08)",
                    border: "1px solid rgba(202,138,4,0.2)",
                    color: "rgba(202,138,4,0.5)",
                    fontSize: "1.1rem",
                  }}
                >
                  📅
                </div>
                <p className="text-xs text-white/40">No upcoming appointments</p>
                <button
                  onClick={bookViaChat}
                  className="text-[11px] px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: "rgba(202,138,4,0.15)",
                    border: "1px solid rgba(202,138,4,0.35)",
                    color: "#D4A017",
                  }}
                >
                  Book an appointment →
                </button>
              </div>
            )}

            {/* Appointment cards */}
            {!apptLoading &&
              !apptError &&
              appts !== null &&
              appts.length > 0 && (
                <div className="flex flex-col gap-2">
                  {appts.map((appt) => (
                    <div
                      key={appt.id}
                      className="rounded-xl px-3 py-2.5"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(202,138,4,0.2)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p
                            className="text-xs font-semibold leading-tight"
                            style={{ color: "#F0C040" }}
                          >
                            {appt.service}
                          </p>
                          <p className="text-[10px] text-white/50 mt-0.5">
                            with {appt.barber}
                          </p>
                        </div>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: "rgba(52,211,153,0.12)",
                            border: "1px solid rgba(52,211,153,0.25)",
                            color: "#6ee7b7",
                          }}
                        >
                          {appt.status}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-3 mt-2 pt-2"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <span className="text-[10px] text-white/50">
                          📅 {fmtApptDate(appt.date)}
                        </span>
                        <span className="text-[10px] text-white/50">
                          🕐 {fmtApptTime(appt.start_time)}
                        </span>
                        <span className="text-[10px] text-white/40 ml-auto">
                          ${appt.price.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      ) : (
        /* ── Message list ───────────────────────────────────────────────────── */
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-3 py-3 space-y-1"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#44403C #0A0A0A" }}
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                style={{
                  background: "rgba(202,138,4,0.1)",
                  border: "1px solid rgba(202,138,4,0.2)",
                }}
              >
                ✂
              </div>
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: "#D4A017",
                    fontFamily: "var(--font-bungee)",
                  }}
                >
                  Hey {user.name.split(" ")[0]}!
                </p>
                <p className="text-[11px] text-white/40 mt-1 max-w-[200px] mx-auto leading-relaxed">
                  Ask me about services, pricing, hours, or book an appointment.
                </p>
              </div>
              {/* Quick prompts */}
              <div className="flex flex-col gap-1.5 w-full max-w-[240px]">
                {[
                  "What services do you offer?",
                  "How much is a fade?",
                  "What are your hours?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => onSend(q)}
                    className="text-[11px] text-left px-3 py-2 rounded-lg transition-all"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.6)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(202,138,4,0.4)";
                      e.currentTarget.style.color = "#D4A017";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.08)";
                      e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                    }}
                  >
                    {q} →
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <Message
              key={msg.id}
              message={msg}
              onSend={isLoading ? undefined : onSend}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Drag-over overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl"
          style={{
            background: "rgba(202,138,4,0.12)",
            border: "2px dashed rgba(202,138,4,0.6)",
            backdropFilter: "blur(2px)",
          }}
        >
          <div className="text-center">
            <p className="text-2xl mb-1">📎</p>
            <p className="text-sm font-semibold" style={{ color: "#F0C040" }}>
              Drop file here
            </p>
          </div>
        </div>
      )}

      {/* Global error banner */}
      {error && (
        <div
          className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2 flex-shrink-0"
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5",
          }}
        >
          <span className="flex-1">{error}</span>
          <button onClick={onClearError} className="opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* File attachment preview */}
      {uploadedFile && (
        <div
          className="mx-3 mb-2 px-3 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"
          style={{
            background: "rgba(202,138,4,0.1)",
            border: "1px solid rgba(202,138,4,0.25)",
          }}
        >
          {uploadedFile.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={uploadedFile.preview}
              alt="attachment preview"
              className="w-8 h-8 object-cover rounded-md"
            />
          ) : (
            <span className="text-lg">📄</span>
          )}
          <span className="text-[11px] text-white/60 flex-1 truncate">
            {uploadedFile.filename}
          </span>
          <button
            onClick={onRemoveFile}
            className="text-white/40 hover:text-white/70 transition-colors"
            aria-label="Remove attachment"
          >
            ✕
          </button>
        </div>
      )}

      {/* File error */}
      {fileError && (
        <div
          className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2 flex-shrink-0"
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5",
          }}
        >
          <span className="flex-1">{fileError}</span>
          <button
            onClick={() => setFileError(null)}
            className="opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-3 pb-3 pt-2 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* File upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.4)",
          }}
          aria-label="Attach file"
          title="Attach image or PDF (max 10MB)"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          onChange={handleFileInput}
          className="hidden"
          aria-label="Upload file"
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Blade anything…"
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-all duration-200 disabled:opacity-50"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontFamily: "var(--font-inter)",
            lineHeight: "1.5",
            maxHeight: 120,
            scrollbarWidth: "none",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.border = "1px solid rgba(202,138,4,0.5)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)")
          }
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
          style={{
            background:
              input.trim() && !isLoading
                ? "linear-gradient(135deg, #92400E, #CA8A04)"
                : "rgba(255,255,255,0.05)",
            border: "none",
          }}
          aria-label="Send message"
        >
          {isLoading ? (
            <span
              className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white inline-block"
              style={{ animation: "spin 0.7s linear infinite" }}
            />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 2L11 13"
                stroke={input.trim() ? "#F0C040" : "rgba(255,255,255,0.3)"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 2L15 22L11 13L2 9L22 2Z"
                stroke={input.trim() ? "#F0C040" : "rgba(255,255,255,0.3)"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </form>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        textarea::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
