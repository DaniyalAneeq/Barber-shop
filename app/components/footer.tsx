"use client";
import React from "react";
import { Mail, Phone, MapPin } from "lucide-react";
import { FooterBackgroundGradient, TextHoverEffect } from "@/app/components/ui/hover-footer";

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

// Scissors icon matching the navbar treatment
const ScissorsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-5 h-5"
    style={{ transform: "rotate(12deg)" }}
  >
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

function BarberFooter() {
  const footerLinks = [
    {
      title: "Services",
      links: [
        { label: "Classic Haircut", href: "#services" },
        { label: "Fade & Taper", href: "#services" },
        { label: "Beard Trim", href: "#services" },
        { label: "Hot Towel Shave", href: "#services" },
        { label: "Kids Cut", href: "#services" },
      ],
    },
    {
      title: "Navigate",
      links: [
        { label: "Home", href: "#home" },
        { label: "About Us", href: "#about" },
        { label: "Gallery", href: "#gallery" },
        { label: "Contact", href: "#contact" },
        { label: "Book Now", href: "#contact", highlight: true },
      ],
    },
  ];

  const contactInfo = [
    {
      icon: <Mail size={15} />,
      text: "hello@barbershop.com",
      href: "mailto:hello@barbershop.com",
    },
    {
      icon: <Phone size={15} />,
      text: "+1 (212) 555-0192",
      href: "tel:+12125550192",
    },
    {
      icon: <MapPin size={15} />,
      text: "123 Main Street, New York",
    },
  ];

  const socialLinks = [
    { icon: <InstagramIcon />, label: "Instagram", href: "https://www.instagram.com/" },
    { icon: <FacebookIcon />, label: "Facebook", href: "https://www.facebook.com/" },
    { icon: <YoutubeIcon />, label: "YouTube", href: "https://www.youtube.com/"},
  ];

  const hours = [
    { day: "Mon – Fri", time: "9:00 AM – 8:00 PM" },
    { day: "Saturday", time: "9:00 AM – 6:00 PM" },
    { day: "Sunday", time: "10:00 AM – 4:00 PM" },
  ];

  return (
    <footer
      className="relative overflow-hidden"
      style={{ backgroundColor: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Main grid */}
      <div
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 md:px-16 lg:px-24"
        style={{ paddingTop: "80px", paddingBottom: "48px" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-10">

          {/* ── Brand column ── */}
          <div className="flex flex-col gap-5">
            {/* Logo — matches navbar */}
            <a href="#home" className="flex items-center gap-3 w-fit group">
              <div
                className="flex items-center justify-center w-9 h-9 flex-shrink-0"
                style={{
                  border: "1px solid rgba(212,160,23,0.55)",
                  borderRadius: "6px",
                  color: "#D4A017",
                  transition: "border-color 0.2s",
                }}
              >
                <ScissorsIcon />
              </div>
              <span
                style={{
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: "13px",
                  letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.9)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                }}
              >
                BARBER SHOP
              </span>
            </a>

            {/* Tagline */}
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "13px",
                color: "rgba(255,255,255,0.5)",
                lineHeight: "1.75",
                maxWidth: "220px",
              }}
            >
              Premium haircuts and precision fades crafted for the modern man.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-4" style={{ marginTop: "4px" }}>
              {socialLinks.map(({ icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex items-center justify-center transition-all duration-200"
                  style={{
                    width: "36px",
                    height: "36px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "rgba(255,255,255,0.4)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,160,23,0.5)";
                    (e.currentTarget as HTMLElement).style.color = "#D4A017";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
                    (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)";
                  }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* ── Link columns ── */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h4
                style={{
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.15em",
                  color: "#D4A017",
                  textTransform: "uppercase",
                  marginBottom: "20px",
                  fontWeight: 500,
                }}
              >
                {section.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "13px",
                        color: (link as any).highlight
                          ? "#D4A017"
                          : "rgba(255,255,255,0.5)",
                        textDecoration: "none",
                        transition: "color 0.2s",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = (link as any).highlight
                          ? "#F0C040"
                          : "rgba(255,255,255,0.9)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = (link as any).highlight
                          ? "#D4A017"
                          : "rgba(255,255,255,0.5)";
                      }}
                    >
                      {(link as any).highlight && (
                        <span style={{ fontSize: "10px" }}>→</span>
                      )}
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* ── Contact + Hours ── */}
          <div className="flex flex-col gap-8">
            {/* Contact */}
            <div>
              <h4
                style={{
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.15em",
                  color: "#D4A017",
                  textTransform: "uppercase",
                  marginBottom: "20px",
                  fontWeight: 500,
                }}
              >
                Contact
              </h4>
              <ul className="flex flex-col gap-4">
                {contactInfo.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      style={{
                        color: "rgba(212,160,23,0.7)",
                        marginTop: "1px",
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </span>
                    {item.href ? (
                      <a
                        href={item.href}
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: "13px",
                          color: "rgba(255,255,255,0.5)",
                          textDecoration: "none",
                          transition: "color 0.2s",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)")
                        }
                      >
                        {item.text}
                      </a>
                    ) : (
                      <span
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: "13px",
                          color: "rgba(255,255,255,0.5)",
                        }}
                      >
                        {item.text}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Hours */}
            <div>
              <h4
                style={{
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.15em",
                  color: "#D4A017",
                  textTransform: "uppercase",
                  marginBottom: "16px",
                  fontWeight: 500,
                }}
              >
                Hours
              </h4>
              <ul className="flex flex-col gap-2">
                {hours.map(({ day, time }) => (
                  <li
                    key={day}
                    className="flex justify-between items-center"
                    style={{ gap: "16px" }}
                  >
                    <span
                      style={{
                        fontFamily: "'Source Code Pro', monospace",
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.38)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {day}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.55)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {time}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: "1px",
            background: "rgba(255,255,255,0.07)",
            margin: "48px 0 32px",
          }}
        />

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p
            style={{
              fontFamily: "'Source Code Pro', monospace",
              fontSize: "10px",
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.28)",
              textTransform: "uppercase",
            }}
          >
            © {new Date().getFullYear()} Barber Shop. All rights reserved.
          </p>

          <div className="flex items-center gap-6">
            {["Privacy Policy", "Terms of Service"].map((label) => (
              <a
                key={label}
                href="#"
                style={{
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  color: "rgba(255,255,255,0.28)",
                  textDecoration: "none",
                  textTransform: "uppercase",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "rgba(212,160,23,0.7)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.28)")
                }
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Text hover effect — "BARBER" watermark ── */}
      <div className="lg:flex hidden h-[28rem] -mt-44 -mb-32 relative z-10">
        <TextHoverEffect text="BARBER" className="z-50" />
      </div>

      <FooterBackgroundGradient />
    </footer>
  );
}

export default BarberFooter;
