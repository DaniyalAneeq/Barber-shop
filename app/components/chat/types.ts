export type ChatStep = "idle" | "auth" | "verify" | "chat";

export interface ChatUser {
  id: string;
  email: string;
  name: string;
  token: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
  isError?: boolean;
  tokensUsed?: number;
}

export interface UploadedFile {
  ref: string;
  mimeType: string;
  filename: string;
  preview?: string; // data URL for images
}

export type SendStatus = "idle" | "sending" | "error";
