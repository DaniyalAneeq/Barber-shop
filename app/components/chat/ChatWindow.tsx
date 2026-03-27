"use client";

/**
 * Chat window — message list + input bar + file attachment.
 * - Auto-scrolls to latest message (pauses when user scrolls up)
 * - Keyboard shortcut: Enter to send, Shift+Enter for newline
 * - Drag-and-drop file upload
 * - Optimistic message display
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = sendStatus === "sending";

  // Auto-scroll to bottom when new messages arrive (if user is at bottom)
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

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
    // Reset textarea height
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
    e.target.value = ""; // reset so same file can be re-selected
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndUpload(file);
  }

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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
            <p className="text-[9px] text-white/40 mt-0.5">AI Barbershop Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Online indicator */}
          <span className="flex items-center gap-1 text-[9px] text-white/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Online
          </span>
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

      {/* Message list */}
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
                style={{ color: "#D4A017", fontFamily: "var(--font-bungee)" }}
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
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
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
          <Message key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

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
          <button onClick={onClearError} className="opacity-60 hover:opacity-100">✕</button>
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
          <button onClick={() => setFileError(null)} className="opacity-60 hover:opacity-100">✕</button>
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
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
