"use client";

/**
 * ChatWidget — the main container that orchestrates the full chat experience.
 *
 * Renders:
 *  - FloatingButton (always visible, bottom-right)
 *  - Animated panel containing the current step:
 *      idle/auth  → AuthModal
 *      verify     → VerificationModal
 *      chat       → ChatWindow
 *
 * Keyboard shortcuts:
 *  - Esc: close widget
 *  - Ctrl+K / ⌘+K: open widget + focus input
 */

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/app/hooks/useChat";
import FloatingButton from "./FloatingButton";
import AuthModal from "./AuthModal";
import VerificationModal from "./VerificationModal";
import ChatWindow from "./ChatWindow";

export default function ChatWidget() {
  const {
    step,
    isOpen,
    user,
    messages,
    sendStatus,
    error,
    pendingEmail,
    uploadedFile,
    unreadCount,
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
  } = useChat();

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) close();
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (!isOpen) open();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, open, close]);

  // Panel height per step
  const panelHeight =
    step === "chat" ? 520 : step === "verify" ? 380 : 420;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3"
      role="region"
      aria-label="Chat assistant"
    >
      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative overflow-hidden rounded-2xl shadow-2xl"
            style={{
              width: 360,
              height: panelHeight,
              background: "#0F0F0F",
              border: "1px solid rgba(202,138,4,0.2)",
              boxShadow:
                "0 0 0 1px rgba(202,138,4,0.08), 0 24px 60px rgba(0,0,0,0.8), 0 0 40px rgba(202,138,4,0.06)",
            }}
          >
            {/* Gold accent line at top */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #CA8A04 30%, #F0C040 50%, #CA8A04 70%, transparent)",
              }}
            />

            {/* Step transitions */}
            <AnimatePresence mode="wait">
              {(step === "idle" || step === "auth") && (
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                  className="h-full overflow-y-auto"
                >
                  <AuthModal
                    onSubmit={register}
                    status={sendStatus}
                    error={error}
                    onClearError={clearError}
                  />
                </motion.div>
              )}

              {step === "verify" && (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  className="h-full overflow-y-auto"
                >
                  <VerificationModal
                    email={pendingEmail}
                    onVerify={verify}
                    onResend={resend}
                    onBack={goBack}
                    status={sendStatus}
                    error={error}
                    onClearError={clearError}
                  />
                </motion.div>
              )}

              {step === "chat" && user && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="h-full"
                >
                  <ChatWindow
                    user={user}
                    messages={messages}
                    sendStatus={sendStatus}
                    error={error}
                    uploadedFile={uploadedFile}
                    onSend={sendUserMessage}
                    onFileUpload={handleFileUpload}
                    onRemoveFile={removeFile}
                    onClearError={clearError}
                    onLogout={logout}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <FloatingButton
        isOpen={isOpen}
        unreadCount={unreadCount}
        onClick={isOpen ? close : open}
      />
    </div>
  );
}
