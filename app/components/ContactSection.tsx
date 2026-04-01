"use client";

import { useState, useId, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  ClockIcon,
  ArrowRightIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import SectionWrapper from "./SectionWrapper";
import { staggerItem, EASE_OUT } from "@/lib/animations";
import { CONTACT, SOCIALS } from "@/data/content";
import {
  fetchServices,
  submitContactBooking,
  ContactApiError,
  type ServiceOption,
} from "@/lib/contactApi";

// ── Form types ────────────────────────────────────────────────────────────────
type Fields = {
  name:    string;
  phone:   string;
  email:   string;
  service: string;
  date:    string;
  message: string;
};

type Errors = Partial<Record<keyof Fields, string>>;

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function maxDateISO() {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString().split("T")[0];
}

// ── Client-side validation ────────────────────────────────────────────────────
function validate(fields: Fields): Errors {
  const errors: Errors = {};

  if (!fields.name.trim())
    errors.name = "Name is required.";

  if (!fields.phone.trim())
    errors.phone = "Phone number is required.";
  else if (!/^[\d\s\-+().]{7,20}$/.test(fields.phone))
    errors.phone = "Enter a valid phone number (7–20 digits).";

  if (!fields.email.trim())
    errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
    errors.email = "Enter a valid email address.";

  if (!fields.service)
    errors.service = "Please select a service.";

  if (!fields.date)
    errors.date = "Please pick a preferred date.";
  else if (fields.date < todayISO())
    errors.date = "Please choose a future date.";
  else if (fields.date > maxDateISO())
    errors.date = "Please choose a date within the next 60 days.";

  return errors;
}

// ── Social icon paths (Simple Icons) ─────────────────────────────────────────
const SOCIAL_ICONS: Record<string, string> = {
  Instagram:
    "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  TikTok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  Facebook:
    "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
};

// ── Info row component ────────────────────────────────────────────────────────
function InfoRow({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <span
        className="mt-0.5 flex-shrink-0 p-2 rounded-lg"
        style={{ background: "rgba(212,160,23,0.1)" }}
      >
        <Icon
          className="w-4 h-4"
          style={{ color: "#CA8A04" }}
          aria-hidden="true"
        />
      </span>
      <div
        className="text-sm leading-relaxed"
        style={{
          fontFamily: "var(--font-inter)",
          color: "rgba(255,255,255,0.65)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Booking form ──────────────────────────────────────────────────────────────
function BookingForm() {
  const uid = useId();
  const id = (key: string) => `${uid}-${key}`;

  const [fields, setFields] = useState<Fields>({
    name:    "",
    phone:   "",
    email:   "",
    service: "",
    date:    "",
    message: "",
  });
  const [errors,       setErrors]       = useState<Errors>({});
  const [serverError,  setServerError]  = useState<string | null>(null);
  const [status,       setStatus]       = useState<"idle" | "loading" | "success">("idle");

  // Services fetched from DB
  const [dbServices,      setDbServices]      = useState<ServiceOption[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError,   setServicesError]   = useState(false);

  // Fetch services on mount
  useEffect(() => {
    fetchServices()
      .then((services) => {
        setDbServices(services);
        setServicesLoading(false);
      })
      .catch(() => {
        setServicesError(true);
        setServicesLoading(false);
      });
  }, []);

  function set(key: keyof Fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    if (serverError) setServerError(null);
  }

  function blurValidate(key: keyof Fields) {
    const e = validate(fields);
    if (e[key]) setErrors((prev) => ({ ...prev, [key]: e[key] }));
  }

  function handleReset() {
    setFields({ name: "", phone: "", email: "", service: "", date: "", message: "" });
    setErrors({});
    setServerError(null);
    setStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(fields);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0] as keyof Fields;
      document.getElementById(id(firstKey))?.focus();
      return;
    }

    setStatus("loading");
    setServerError(null);

    try {
      await submitContactBooking({
        full_name:      fields.name,
        phone:          fields.phone,
        email:          fields.email,
        service:        fields.service,
        preferred_date: fields.date,
        message:        fields.message || undefined,
      });
      setStatus("success");
    } catch (err) {
      setStatus("idle");

      if (err instanceof ContactApiError) {
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
          const firstKey = Object.keys(err.fieldErrors)[0] as keyof Fields;
          document.getElementById(id(firstKey))?.focus();
        } else {
          setServerError(
            err.status >= 500
              ? "Something went wrong. Please try again or call us directly at (555) 123-4567."
              : err.message,
          );
        }
      } else {
        setServerError(
          "Something went wrong. Please try again or call us directly at (555) 123-4567.",
        );
      }
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <AnimatePresence>
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [...EASE_OUT] as [number,number,number,number] }}
          className="flex flex-col items-center justify-center gap-5 py-16 text-center"
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5, type: "spring", stiffness: 200, damping: 18 }}
            className="flex items-center justify-center w-20 h-20 rounded-full"
            style={{ background: "rgba(212,160,23,0.12)", border: "1.5px solid rgba(212,160,23,0.35)" }}
          >
            <CheckIcon className="w-9 h-9" style={{ color: "#D4A017" }} />
          </motion.div>

          <div>
            <h3
              className="text-2xl text-white mb-2"
              style={{ fontFamily: "var(--font-bungee)", letterSpacing: "0.03em" }}
            >
              Booking Received
            </h3>
            <p
              className="text-sm mb-6"
              style={{ fontFamily: "var(--font-inter)", color: "rgba(255,255,255,0.5)" }}
            >
              We&apos;ll confirm your appointment shortly. Check your email for a reference number.
            </p>
            <button
              onClick={handleReset}
              className="text-xs underline underline-offset-4 transition-colors duration-200"
              style={{
                fontFamily: "var(--font-source-code-pro)",
                color: "rgba(212,160,23,0.7)",
              }}
            >
              Book another appointment
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Shared styles ───────────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-source-code-pro)",
    color: "rgba(255,255,255,0.5)",
    fontSize: "0.7rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    display: "block",
    marginBottom: "0.375rem",
  };

  const errorStyle: React.CSSProperties = {
    fontFamily: "var(--font-inter)",
    color: "rgba(239,68,68,0.85)",
    fontSize: "0.75rem",
    marginTop: "0.3rem",
  };

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

      {/* Name + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor={id("name")} style={labelStyle}>Full Name</label>
          <input
            id={id("name")}
            type="text"
            autoComplete="name"
            placeholder="Jordan Mitchell"
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            onBlur={() => blurValidate("name")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? id("name-err") : undefined}
            className={`form-input${errors.name ? " error" : ""}`}
          />
          {errors.name && (
            <p id={id("name-err")} style={errorStyle} role="alert">{errors.name}</p>
          )}
        </div>
        <div>
          <label htmlFor={id("phone")} style={labelStyle}>Phone</label>
          <input
            id={id("phone")}
            type="tel"
            autoComplete="tel"
            placeholder="+1 (555) 000-0000"
            value={fields.phone}
            onChange={(e) => set("phone", e.target.value)}
            onBlur={() => blurValidate("phone")}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? id("phone-err") : undefined}
            className={`form-input${errors.phone ? " error" : ""}`}
          />
          {errors.phone && (
            <p id={id("phone-err")} style={errorStyle} role="alert">{errors.phone}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor={id("email")} style={labelStyle}>Email</label>
        <input
          id={id("email")}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={fields.email}
          onChange={(e) => set("email", e.target.value)}
          onBlur={() => blurValidate("email")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? id("email-err") : undefined}
          className={`form-input${errors.email ? " error" : ""}`}
        />
        {errors.email && (
          <p id={id("email-err")} style={errorStyle} role="alert">{errors.email}</p>
        )}
      </div>

      {/* Service + Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor={id("service")} style={labelStyle}>Service</label>
          <select
            id={id("service")}
            value={fields.service}
            onChange={(e) => set("service", e.target.value)}
            onBlur={() => blurValidate("service")}
            aria-invalid={!!errors.service}
            aria-describedby={errors.service ? id("service-err") : undefined}
            disabled={servicesLoading}
            className={`form-select${errors.service ? " error" : ""}`}
          >
            <option value="" disabled>
              {servicesLoading
                ? "Loading services…"
                : servicesError
                ? "Failed to load — refresh"
                : "Select a service…"}
            </option>
            {!servicesLoading && !servicesError && dbServices.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} — ${s.price % 1 === 0 ? s.price.toFixed(0) : s.price.toFixed(2)}
              </option>
            ))}
          </select>
          {errors.service && (
            <p id={id("service-err")} style={errorStyle} role="alert">{errors.service}</p>
          )}
        </div>
        <div>
          <label htmlFor={id("date")} style={labelStyle}>Preferred Date</label>
          <input
            id={id("date")}
            type="date"
            min={todayISO()}
            max={maxDateISO()}
            value={fields.date}
            onChange={(e) => set("date", e.target.value)}
            onBlur={() => blurValidate("date")}
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? id("date-err") : undefined}
            className={`form-input${errors.date ? " error" : ""}`}
          />
          {errors.date && (
            <p id={id("date-err")} style={errorStyle} role="alert">{errors.date}</p>
          )}
        </div>
      </div>

      {/* Message */}
      <div>
        <label htmlFor={id("message")} style={labelStyle}>
          Message <span style={{ opacity: 0.45, fontSize: "0.65rem" }}>(optional)</span>
        </label>
        <textarea
          id={id("message")}
          rows={4}
          placeholder="Any special requests or notes…"
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
          className="form-input resize-none"
          style={{ resize: "none" }}
        />
      </div>

      {/* Server error banner */}
      {serverError && (
        <div
          role="alert"
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            fontFamily: "var(--font-inter)",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "rgba(239,68,68,0.9)",
          }}
        >
          {serverError}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "loading" || servicesLoading}
        className="btn-gold w-full flex items-center justify-center gap-3
          px-7 py-4 rounded-xl font-semibold tracking-wide text-sm cursor-pointer
          disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          fontFamily: "var(--font-source-code-pro)",
          color: "#0A0A0A",
          letterSpacing: "0.08em",
        }}
      >
        <AnimatePresence mode="wait">
          {status === "loading" ? (
            <motion.span
              key="spinner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <svg
                className="animate-spin w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Sending…
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              Book Appointment
              <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <p
        className="text-center text-xs"
        style={{ fontFamily: "var(--font-inter)", color: "rgba(255,255,255,0.28)" }}
      >
        Walk-ins welcome · Appointments get priority
      </p>
    </form>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function ContactSection() {
  return (
    <SectionWrapper
      id="contact"
      style={{
        background:
          "radial-gradient(ellipse at 80% 20%, rgba(28,25,23,0.55) 0%, #0A0A0A 60%)",
      } as React.CSSProperties}
    >
      {/* Top edge divider */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, rgba(212,160,23,0.15) 30%, rgba(212,160,23,0.15) 70%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto">

        {/* ── Section header ── */}
        <motion.div variants={staggerItem} className="text-center mb-14">
          <p
            className="text-[11px] tracking-[0.35em] uppercase mb-4"
            style={{ fontFamily: "var(--font-source-code-pro)", color: "#CA8A04" }}
          >
            // Book Now
          </p>
          <h2
            className="text-4xl md:text-5xl text-white mb-4"
            style={{ fontFamily: "var(--font-bungee)", letterSpacing: "0.03em" }}
          >
            Reserve Your Chair
          </h2>
          <p
            className="text-sm md:text-base max-w-sm mx-auto leading-relaxed"
            style={{ fontFamily: "var(--font-inter)", color: "rgba(255,255,255,0.42)" }}
          >
            Fill in the form and we&apos;ll lock in your slot.
          </p>
          <div className="flex justify-center mt-6">
            <div
              className="h-px w-16 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, transparent, #CA8A04, #F0C040, transparent)",
              }}
            />
          </div>
        </motion.div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* ─ LEFT: Booking form ─ */}
          <motion.div
            variants={staggerItem}
            className="rounded-2xl p-6 md:p-8"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <h3
              className="text-lg text-white mb-6"
              style={{ fontFamily: "var(--font-bungee)", letterSpacing: "0.04em" }}
            >
              Book an Appointment
            </h3>
            <BookingForm />
          </motion.div>

          {/* ─ RIGHT: Info + Map ─ */}
          <motion.div variants={staggerItem} className="flex flex-col gap-8">

            {/* Info card */}
            <div
              className="rounded-2xl p-6 md:p-8 flex flex-col gap-5"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <h3
                className="text-lg text-white"
                style={{ fontFamily: "var(--font-bungee)", letterSpacing: "0.04em" }}
              >
                Visit the Shop
              </h3>

              <InfoRow icon={MapPinIcon}>
                {CONTACT.address}
              </InfoRow>

              <InfoRow icon={PhoneIcon}>
                <a
                  href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}
                  className="hover:text-yellow-400 transition-colors duration-200"
                >
                  {CONTACT.phone}
                </a>
              </InfoRow>

              <InfoRow icon={EnvelopeIcon}>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="hover:text-yellow-400 transition-colors duration-200"
                >
                  {CONTACT.email}
                </a>
              </InfoRow>

              <InfoRow icon={ClockIcon}>
                <div className="flex flex-col gap-1">
                  {CONTACT.hours.map((h) => (
                    <div key={h.days} className="flex justify-between gap-4">
                      <span>{h.days}</span>
                      <span style={{ color: "rgba(255,255,255,0.38)" }}>{h.time}</span>
                    </div>
                  ))}
                </div>
              </InfoRow>

              {/* Divider */}
              <div
                className="h-px w-full"
                style={{ background: "rgba(255,255,255,0.06)" }}
                aria-hidden="true"
              />

              {/* Social links */}
              <div className="flex items-center gap-3">
                {SOCIALS.map((s) => (
                  <a
                    key={s.platform}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Follow us on ${s.platform}`}
                    className="flex items-center justify-center w-9 h-9 rounded-full
                      transition-all duration-200 cursor-pointer"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background =
                        "rgba(212,160,23,0.15)";
                      (e.currentTarget as HTMLAnchorElement).style.borderColor =
                        "rgba(212,160,23,0.35)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background =
                        "rgba(255,255,255,0.05)";
                      (e.currentTarget as HTMLAnchorElement).style.borderColor =
                        "rgba(255,255,255,0.08)";
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4"
                      fill="currentColor"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                      aria-hidden="true"
                    >
                      <path d={SOCIAL_ICONS[s.platform] ?? ""} />
                    </svg>
                  </a>
                ))}
                <span
                  className="ml-1 text-[11px]"
                  style={{
                    fontFamily: "var(--font-source-code-pro)",
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  @barbershopnyc
                </span>
              </div>
            </div>

            {/* Map */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="relative w-full" style={{ height: "240px" }}>
                <iframe
                  title="Barber Shop location map"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3023.7!2d-74.0!3d40.73!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDQzJzQ4LjAiTiA3NMKwMDAnMDAuMCJX!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus"
                  width="100%"
                  height="240"
                  style={{
                    border: 0,
                    filter: "invert(92%) hue-rotate(180deg) saturate(0.9)",
                    display: "block",
                  }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>

          </motion.div>
        </div>

      </div>
    </SectionWrapper>
  );
}
