/**
 * Type-safe API client for the BarberShop chatbot backend.
 * All requests include Authorization: Bearer <token> when available.
 * Implements exponential back-off retry for network failures.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_CHATBOT_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegisterPayload {
  email: string;
  name: string;
}

export interface RegisterResponse {
  message: string;
  email: string;
  cooldown_seconds: number;
}

export interface VerifyPayload {
  email: string;
  code: string;
}

export interface VerifyResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  name: string;
  email: string;
}

export interface MessagePayload {
  message: string;
  session_id?: string;
  file_ref?: string;
}

export interface MessageResponse {
  id: string;
  session_id: string;
  content: string;
  tokens_used?: number;
  created_at: string;
}

export interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  tokens_used?: number;
}

export interface HistoryResponse {
  session_id: string;
  messages: HistoryMessage[];
  has_more: boolean;
  total: number;
}

export interface UploadResponse {
  file_ref: string;
  mime_type: string;
  filename: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit & { token?: string; retries?: number } = {},
): Promise<T> {
  const { token, retries = 2, ...init } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body?.detail || res.statusText;
        throw new ApiError(res.status, detail, detail);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err as Error;
      // Don't retry on 4xx errors
      if (err instanceof ApiError && err.status < 500) throw err;
      if (attempt < retries) {
        await sleep(Math.pow(2, attempt) * 500); // 500ms, 1s, 2s
      }
    }
  }

  throw lastError;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export async function registerUser(
  payload: RegisterPayload,
): Promise<RegisterResponse> {
  return request<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyCode(
  payload: VerifyPayload,
): Promise<VerifyResponse> {
  return request<VerifyResponse>("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resendCode(email: string): Promise<RegisterResponse> {
  return request<RegisterResponse>("/api/auth/resend", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// ── Chat API ──────────────────────────────────────────────────────────────────

export async function sendMessage(
  payload: MessagePayload,
  token: string,
): Promise<MessageResponse> {
  return request<MessageResponse>("/api/chat/message", {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function getHistory(
  token: string,
  sessionId?: string,
): Promise<HistoryResponse> {
  const qs = sessionId ? `?session_id=${sessionId}` : "";
  return request<HistoryResponse>(`/api/chat/history${qs}`, { token });
}

export async function uploadFile(
  file: File,
  token: string,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE_URL}/api/chat/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.detail || "Upload failed");
  }

  return res.json() as Promise<UploadResponse>;
}

/**
 * Stream AI response via Server-Sent Events.
 * Calls `onChunk` for each text delta, `onDone` when complete.
 */
export async function streamMessage(
  payload: MessagePayload,
  token: string,
  onChunk: (chunk: string) => void,
  onSessionId: (id: string) => void,
  onDone: (messageId: string) => void,
  onError: (err: string) => void,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.detail || "Stream failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let eventType = "message";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (eventType === "session") {
          onSessionId(data);
        } else if (eventType === "done") {
          onDone(data);
        } else if (eventType === "error") {
          onError(data);
        } else {
          // Un-escape newlines
          onChunk(data.replace(/\\n/g, "\n"));
        }
        eventType = "message";
      }
    }
  }
}
