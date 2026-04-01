/**
 * Type-safe API client for the web-backend (contact form / services).
 * Base URL is controlled by NEXT_PUBLIC_WEB_API_URL (defaults to port 8001).
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_WEB_API_URL || "http://localhost:8001";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceOption {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
}

export interface ContactBookingPayload {
  full_name: string;
  phone: string;
  email: string;
  service: string;          // service name (matched against DB)
  preferred_date: string;   // "YYYY-MM-DD"
  message?: string;
}

export interface ContactBookingResponse {
  id: number;
  full_name: string;
  email: string;
  service: string;
  preferred_date: string;
  status: string;
  created_at: string;
}

/** Field-keyed validation errors — keys match the form's Fields type. */
export type ContactFieldErrors = Partial<
  Record<"name" | "phone" | "email" | "service" | "date" | "message", string>
>;

export class ContactApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Present on 422 responses — field-level errors to show inline. */
    public fieldErrors?: ContactFieldErrors,
  ) {
    super(message);
    this.name = "ContactApiError";
  }
}

// ── API field → form field name mapping ───────────────────────────────────────

const API_TO_FORM: Record<string, keyof ContactFieldErrors> = {
  full_name: "name",
  preferred_date: "date",
  phone: "phone",
  email: "email",
  service: "service",
  message: "message",
};

function parseFieldErrors(detail: unknown[]): ContactFieldErrors {
  const out: ContactFieldErrors = {};
  for (const err of detail) {
    const e = err as { loc: string[]; msg: string };
    const rawKey = e.loc[e.loc.length - 1];
    const formKey = API_TO_FORM[rawKey] ?? (rawKey as keyof ContactFieldErrors);
    // Pydantic v2 prefixes validator errors with "Value error, " — strip it
    out[formKey] = e.msg.replace(/^Value error,\s*/i, "");
  }
  return out;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchServices(): Promise<ServiceOption[]> {
  const res = await fetch(`${BASE_URL}/api/web/services`);
  if (!res.ok) {
    throw new Error(`Failed to load services (HTTP ${res.status})`);
  }
  return res.json() as Promise<ServiceOption[]>;
}

export async function submitContactBooking(
  payload: ContactBookingPayload,
): Promise<ContactBookingResponse> {
  const res = await fetch(`${BASE_URL}/api/web/contact/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    return res.json() as Promise<ContactBookingResponse>;
  }

  const body = await res.json().catch(() => ({})) as {
    detail?: unknown;
  };

  // 422 — Pydantic / service validation errors with field locations
  if (res.status === 422) {
    const detail = body?.detail;
    if (Array.isArray(detail)) {
      const fieldErrors = parseFieldErrors(detail);
      throw new ContactApiError(422, "Please fix the errors below.", fieldErrors);
    }
    throw new ContactApiError(
      422,
      typeof detail === "string" ? detail : "Invalid data submitted.",
    );
  }

  // 4xx — bad request (e.g. service not found after dropdown populated)
  if (res.status >= 400 && res.status < 500) {
    const msg =
      typeof body?.detail === "string"
        ? body.detail
        : "Your request could not be processed. Please try again.";
    throw new ContactApiError(res.status, msg);
  }

  // 5xx
  throw new ContactApiError(
    res.status,
    "Something went wrong. Please try again or call us directly at (555) 123-4567.",
  );
}
