// ─────────────────────────────────────────────────────────────────────────────
// BARBER SHOP — Single source of truth for all site content
// Edit this file to update text, prices, team, or contact info globally.
// ─────────────────────────────────────────────────────────────────────────────

// ── Site-wide ────────────────────────────────────────────────────────────────

export const SITE = {
  name:        "Barber Shop",
  tagline:     "Look Sharp. Feel Unstoppable.",
  description: "Premium haircuts and precision fades crafted for modern men.",
  url:         "https://barbershop.com",
};

// ── Navigation ───────────────────────────────────────────────────────────────

export const NAV_LINKS = [
  { label: "Home",     href: "#home"     },
  { label: "Services", href: "#services" },
  { label: "About",    href: "#about"    },
  { label: "Gallery",  href: "#gallery"  },
  { label: "Contact",  href: "#contact"  },
] as const;

// ── Hero ─────────────────────────────────────────────────────────────────────

export const HERO = {
  headline:   "Look Sharp.\nFeel Unstoppable.",
  subheading: "Premium haircuts and precision fades crafted for modern men.",
  cta:        "Book Your Appointment",
  videoSrc:   "/video/Luxury_Barbershop_Cinematic_Video_Generation.mp4",
};

// ── Stats ────────────────────────────────────────────────────────────────────

export const STATS = [
  { number: "10+",  label: "Years Experience" },
  { number: "5K+",  label: "Happy Clients"    },
  { number: "4.9★", label: "Star Rating"      },
] as const;

// ── About ─────────────────────────────────────────────────────────────────────

export const ABOUT = {
  label: "// Our Story",
  heading: "Crafted with\nprecision.\nBuilt on trust.",
  paragraphs: [
    "What started as a single chair in a backstreet studio has grown into a destination for men who refuse to settle for ordinary. Marcus Cole opened these doors in 2010 with one obsession: the perfect cut, delivered with respect.",
    "Today our team carries that same standard forward — blending old-world craft with modern precision. Every client who sits in our chair gets full attention, full skill, every single time. No rush. No shortcuts.",
  ],
  miniStats: [
    { number: "15+",  label: "Years in Business" },
    { number: "400+", label: "Cuts Per Month"    },
  ],
} as const;

// ── Services ─────────────────────────────────────────────────────────────────

export type Service = {
  id:          string;
  name:        string;
  price:       string;
  duration:    string;
  description: string;
  badge?:      string;        // e.g. "Most Popular"
};

export const SERVICES: Service[] = [
  {
    id:          "classic-cut",
    name:        "Classic Haircut",
    price:       "$35",
    duration:    "45 min",
    description: "A timeless cut tailored to your face shape. Includes consultation, wash, cut, and style.",
  },
  {
    id:          "precision-fade",
    name:        "Precision Fade",
    price:       "$45",
    duration:    "50 min",
    description: "Skin-to-length fade executed with surgical precision. Zero mistakes, maximum edge.",
  },
  {
    id:          "beard-trim",
    name:        "Beard Trim & Shape",
    price:       "$25",
    duration:    "30 min",
    description: "Define your beard line, trim loose ends, and walk out looking like a gentleman.",
  },
  {
    id:          "hot-towel-shave",
    name:        "Hot Towel Shave",
    price:       "$40",
    duration:    "40 min",
    description: "Traditional straight-razor shave with hot towel prep. Close, clean, and ritual.",
  },
  {
    id:          "hair-beard-combo",
    name:        "Hair + Beard Combo",
    price:       "$65",
    duration:    "75 min",
    description: "The full treatment — fresh cut plus shaped beard. Best value in the shop.",
    badge:       "Most Popular",
  },
  {
    id:          "kids-cut",
    name:        "Kids Cut",
    price:       "$20",
    duration:    "30 min",
    description: "Patient, friendly service for the little ones. Every kid deserves a sharp look.",
  },
];

// ── Team ─────────────────────────────────────────────────────────────────────

export type TeamMember = {
  id:          string;
  name:        string;
  role:        string;
  bio:         string;
  photo:       string;          // path relative to /public
  specialties: string[];
  instagram?:  string;
};

export const TEAM: TeamMember[] = [
  {
    id:          "marcus-cole",
    name:        "Marcus Cole",
    role:        "Head Barber & Founder",
    bio:         "With 15 years behind the chair, Marcus built this shop on one principle: every client walks out feeling like the best version of themselves.",
    photo:       "/images/team/marcus.jpg",
    specialties: ["Skin Fades", "Classic Cuts", "Beard Sculpting"],
    instagram:   "@marcusbarbershop",
  },
  {
    id:          "deion-james",
    name:        "Deion James",
    role:        "Senior Barber",
    bio:         "Deion's razor-sharp attention to detail has earned him a loyal following. Known for transformative fades and textured styles.",
    photo:       "/images/team/deion.jpg",
    specialties: ["Textured Fades", "Designs", "Natural Hair"],
    instagram:   "@deioncutz",
  },
  {
    id:          "rafael-santos",
    name:        "Rafael Santos",
    role:        "Barber",
    bio:         "Rafael blends Brazilian grooming traditions with modern precision. His hot-towel shaves are legendary among regulars.",
    photo:       "/images/team/rafael.jpg",
    specialties: ["Hot Towel Shaves", "Beard Grooming", "Afro Cuts"],
    instagram:   "@rafaelthebarbr",
  },
];

// ── Gallery ──────────────────────────────────────────────────────────────────

export type GalleryItem = {
  id:    string;
  src:   string;         // path relative to /public
  alt:   string;
  label?: string;
};

export const GALLERY: GalleryItem[] = [
  // g1 & g5 are row-span-2 (tall) → use portrait images
  // g6 is col-span-2 (wide) → use landscape image
  { id: "g1", src: "/gallery/aleksandar-andreev-XbM0XATexu8-unsplash.jpg", alt: "Clean skin fade — side profile",  label: "Skin Fade"       }, // portrait 3579×4772
  { id: "g2", src: "/gallery/side-view-man-getting-haircut.jpg",           alt: "Classic precision cut",           label: "Classic Cut"     }, // landscape → normal slot
  { id: "g3", src: "/gallery/pexels-shkrabaanthony-4625630.jpg",           alt: "Shaped full beard close-up",      label: "Beard Sculpt"    }, // portrait 4000×6000
  { id: "g4", src: "/gallery/stephen-walker-bb-C3RNEwME-unsplash.jpg",    alt: "Mid-low fade with line design",   label: "Fade + Design"   }, // portrait 2476×3000
  { id: "g5", src: "/gallery/delfina-pan-wJoB8D3hnzc-unsplash.jpg",       alt: "Textured crop — front view",      label: "Textured Crop"   }, // portrait 2240×3360
  { id: "g6", src: "/gallery/kid-getting-haircut-salon-side-view.jpg",     alt: "Junior cut — salon side view",    label: "Kids Cut"        }, // landscape 7999×5322 → wide slot
];

// ── Testimonials ─────────────────────────────────────────────────────────────

export type Testimonial = {
  id:     string;
  name:   string;
  rating: number;        // 1–5
  text:   string;
  date:   string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    id:     "t1",
    name:   "Jordan M.",
    rating: 5,
    text:   "Best fade I've ever had. Marcus read exactly what I wanted before I even finished explaining. Already booked my next appointment.",
    date:   "March 2025",
  },
  {
    id:     "t2",
    name:   "Chris T.",
    rating: 5,
    text:   "The hot towel shave alone is worth the trip. Rafael takes his time and the result is insanely clean. Luxury experience for a fair price.",
    date:   "February 2025",
  },
  {
    id:     "t3",
    name:   "Andre L.",
    rating: 5,
    text:   "Been coming here for 3 years. Deion knows my hair better than I do. Consistent every single time — that's rare.",
    date:   "January 2025",
  },
];

// ── Contact ──────────────────────────────────────────────────────────────────

export const CONTACT = {
  address: "142 West 10th Street, New York, NY 10014",
  phone:   "+1 (212) 555-0192",
  email:   "hello@barbershop.com",
  mapUrl:  "https://maps.google.com",
  hours: [
    { days: "Monday – Friday", time: "9:00 AM – 8:00 PM" },
    { days: "Saturday",        time: "8:00 AM – 7:00 PM" },
    { days: "Sunday",          time: "10:00 AM – 5:00 PM" },
  ],
} as const;

// ── Social links ─────────────────────────────────────────────────────────────

export const SOCIALS = [
  { platform: "Instagram", href: "https://instagram.com", handle: "@barbershopnyc" },
  { platform: "TikTok",    href: "https://tiktok.com",    handle: "@barbershopnyc" },
  { platform: "Facebook",  href: "https://facebook.com",  handle: "BarberShopNYC"  },
] as const;
