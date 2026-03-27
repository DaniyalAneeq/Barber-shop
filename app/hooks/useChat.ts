"use client";

/**
 * useChat — central state machine for the chatbot widget.
 *
 * Manages:
 * - Auth flow (idle → auth → verify → chat)
 * - Session persistence in localStorage
 * - Message list with optimistic updates
 * - Streaming AI responses
 * - File uploads
 * - Error handling with retry
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  getHistory,
  registerUser,
  resendCode,
  sendMessage,
  streamMessage,
  uploadFile,
  verifyCode,
} from "@/lib/chatApi";
import type {
  ChatMessage,
  ChatStep,
  ChatUser,
  SendStatus,
  UploadedFile,
} from "@/app/components/chat/types";

const STORAGE_KEY = "bs_chat_session";

interface StoredSession {
  user: ChatUser;
  sessionId?: string;
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(data: StoredSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useChat() {
  const [step, setStep] = useState<ChatStep>("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<ChatUser | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const streamingIdRef = useRef<string | null>(null);

  // ── Restore session on mount ───────────────────────────────────────────────
  useEffect(() => {
    const stored = loadSession();
    if (stored?.user) {
      setUser(stored.user);
      setSessionId(stored.sessionId);
      setStep("chat");
    }
  }, []);

  // ── Load history when entering chat ───────────────────────────────────────
  useEffect(() => {
    if (step === "chat" && user && !historyLoaded) {
      setHistoryLoaded(true);
      getHistory(user.token, sessionId)
        .then((data) => {
          if (data.messages.length > 0) {
            setSessionId(data.session_id);
            setMessages(
              data.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: new Date(m.created_at),
                tokensUsed: m.tokens_used,
              }))
            );
          }
        })
        .catch(() => {
          // No history yet — that's fine
        });
    }
  }, [step, user, sessionId, historyLoaded]);

  // ── Increment unread when widget is closed and AI responds ────────────────
  const addMessage = useCallback(
    (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (!isOpen && msg.role === "assistant") {
        setUnreadCount((n) => n + 1);
      }
    },
    [isOpen]
  );

  const open = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
    if (step === "idle") setStep("auth");
  }, [step]);

  const close = useCallback(() => setIsOpen(false), []);

  const clearError = useCallback(() => setError(null), []);

  // ── Auth flow ─────────────────────────────────────────────────────────────

  const register = useCallback(
    async (email: string, name: string) => {
      setError(null);
      setSendStatus("sending");
      try {
        await registerUser({ email, name });
        setPendingEmail(email);
        setPendingName(name);
        setStep("verify");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
      } finally {
        setSendStatus("idle");
      }
    },
    []
  );

  const verify = useCallback(
    async (code: string) => {
      setError(null);
      setSendStatus("sending");
      try {
        const data = await verifyCode({ email: pendingEmail, code });
        const newUser: ChatUser = {
          id: data.user_id,
          email: data.email,
          name: data.name,
          token: data.access_token,
        };
        setUser(newUser);
        saveSession({ user: newUser });
        setStep("chat");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Verification failed. Please try again.");
      } finally {
        setSendStatus("idle");
      }
    },
    [pendingEmail]
  );

  const resend = useCallback(async () => {
    setError(null);
    try {
      await resendCode(pendingEmail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend. Please wait.");
    }
  }, [pendingEmail]);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setSessionId(undefined);
    setMessages([]);
    setHistoryLoaded(false);
    setStep("auth");
    setIsOpen(true);
  }, []);

  const goBack = useCallback(() => {
    setStep("auth");
    clearError();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sending messages ──────────────────────────────────────────────────────

  const sendUserMessage = useCallback(
    async (text: string) => {
      if (!user || !text.trim() || sendStatus === "sending") return;

      const optimisticId = `opt-${Date.now()}`;
      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        role: "user",
        content: text.trim(),
        createdAt: new Date(),
      };
      addMessage(optimisticMsg);

      // Add streaming placeholder for assistant
      const streamId = `stream-${Date.now()}`;
      streamingIdRef.current = streamId;
      const streamingMsg: ChatMessage = {
        id: streamId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
        isStreaming: true,
      };
      addMessage(streamingMsg);

      setSendStatus("sending");
      setError(null);

      const fileRef = uploadedFile?.ref;
      setUploadedFile(null);

      let newSessionId = sessionId;

      try {
        await streamMessage(
          { message: text.trim(), session_id: sessionId, file_ref: fileRef },
          user.token,
          // onChunk — append to streaming message
          (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamId
                  ? { ...m, content: m.content + chunk }
                  : m
              )
            );
          },
          // onSessionId
          (id) => {
            newSessionId = id;
            setSessionId(id);
            saveSession({ user, sessionId: id });
          },
          // onDone — replace streaming placeholder with final message
          (msgId) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamId ? { ...m, id: msgId, isStreaming: false } : m
              )
            );
            streamingIdRef.current = null;
          },
          // onError
          (errMsg) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamId
                  ? { ...m, content: "Sorry, something went wrong. Please try again.", isStreaming: false, isError: true }
                  : m
              )
            );
            setError(errMsg);
          }
        );
      } catch (err) {
        // Remove streaming placeholder and show error in message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamId
              ? {
                  ...m,
                  content: "Sorry, I couldn't process that. Please try again.",
                  isStreaming: false,
                  isError: true,
                }
              : m
          )
        );
        if (err instanceof ApiError && err.status === 401) {
          // Token expired — force re-auth
          logout();
        }
      } finally {
        setSendStatus("idle");
      }
    },
    [user, sessionId, sendStatus, uploadedFile, addMessage, logout]
  );

  // ── File upload ───────────────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!user) return;
      try {
        const result = await uploadFile(file, user.token);
        const preview = file.type.startsWith("image/")
          ? await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
            })
          : undefined;

        setUploadedFile({
          ref: result.file_ref,
          mimeType: result.mime_type,
          filename: result.filename,
          preview,
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "File upload failed.");
      }
    },
    [user]
  );

  const removeFile = useCallback(() => setUploadedFile(null), []);

  return {
    // State
    step,
    isOpen,
    user,
    messages,
    sendStatus,
    error,
    pendingEmail,
    uploadedFile,
    unreadCount,
    // Actions
    open,
    close,
    clearError,
    register,
    verify,
    resend,
    logout,
    goBack,
    sendUserMessage,
    handleFileUpload,
    removeFile,
  };
}
