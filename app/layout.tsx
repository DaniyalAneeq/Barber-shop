import type { Metadata } from "next";
import { Bungee, Inter, Source_Code_Pro } from "next/font/google";
import "./globals.css";

const bungee = Bungee({
  weight: "400",
  variable: "--font-bungee",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code-pro",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const BASE_URL = "https://barbershop.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Barber Shop — Look Sharp. Feel Unstoppable.",
  description:
    "Premium haircuts and precision fades crafted for modern men.",
  alternates: { canonical: "/" },
  openGraph: {
    title:       "Barber Shop — Look Sharp. Feel Unstoppable.",
    description: "Premium haircuts and precision fades crafted for modern men.",
    url:         BASE_URL,
    siteName:    "Barber Shop",
    type:        "website",
    images: [
      {
        url:    "/og-image.jpg",
        width:  1200,
        height: 630,
        alt:    "Barber Shop — premium haircuts and precision fades",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${bungee.variable} ${inter.variable} ${sourceCodePro.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context":       "https://schema.org",
              "@type":          "HairSalon",
              name:             "Barber Shop",
              description:      "Premium haircuts and precision fades crafted for modern men.",
              url:              BASE_URL,
              image:            `${BASE_URL}/og-image.jpg`,
              priceRange:       "$$",
              openingHoursSpecification: [
                {
                  "@type":    "OpeningHoursSpecification",
                  dayOfWeek:  ["Monday","Tuesday","Wednesday","Thursday","Friday"],
                  opens:      "09:00",
                  closes:     "19:00",
                },
                {
                  "@type":    "OpeningHoursSpecification",
                  dayOfWeek:  ["Saturday"],
                  opens:      "09:00",
                  closes:     "17:00",
                },
              ],
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
