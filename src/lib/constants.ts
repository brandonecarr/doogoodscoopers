// Site-wide constants

export const SITE_CONFIG = {
  name: "DooGoodScoopers",
  tagline: "Professional Dog Waste Removal",
  phone: "(909) 366-3744",
  email: "service@doogoodscoopers.com",
  address: {
    street: "11799 Sebastian Way, Suite 103",
    city: "Rancho Cucamonga",
    state: "CA",
    zip: "91730",
  },
  hours: {
    weekday: "7:30 AM - 6:00 PM",
    weekend: "9:00 AM - 5:00 PM",
  },
  social: {
    facebook: "https://facebook.com/doogoodscoopers",
    instagram: "https://instagram.com/doogoodscoopers",
    yelp: "https://yelp.com/biz/doogoodscoopers",
    google: "https://g.page/doogoodscoopers",
  },
};

export const NAV_LINKS = [
  { id: "residential", label: "Residential", href: "/residential-services" },
  { id: "commercial", label: "Commercial", href: "/commercial-services" },
  { id: "about", label: "About", href: "/about-doogoodscoopers" },
  { id: "get-quote", label: "Get a Quote", href: "/quote" },
];

export const STATS = [
  { label: "Happy Families", value: 111, suffix: "+" },
  { label: "Happy Dogs", value: 240, suffix: "+" },
  { label: "Yards Completed", value: 2123, suffix: "" },
  { label: "Star Rating", value: 5.0, suffix: "", prefix: "", isRating: true },
];

export const SERVICE_AREAS = [
  "Fontana",
  "Rancho Cucamonga",
  "Ontario",
  "Upland",
  "Claremont",
  "Montclair",
  "Pomona",
  "Chino",
  "Chino Hills",
  "Diamond Bar",
  "Eastvale",
  "Norco",
  "Corona",
  "Riverside",
  "Rialto",
  "Colton",
  "San Bernardino",
  "Highland",
  "Redlands",
  "Loma Linda",
];

export const PROCESS_STEPS = [
  {
    number: 1,
    title: "Get Your Quote",
    description:
      "Tell us about your yard and furry friends. We'll provide a free, no-obligation quote tailored to your needs.",
    icon: "clipboard-list",
  },
  {
    number: 2,
    title: "Schedule Service",
    description:
      "Choose a day that works for you. We offer flexible weekly, bi-weekly, or one-time cleanings.",
    icon: "calendar",
  },
  {
    number: 3,
    title: "Enjoy Your Yard",
    description:
      "Relax while we do the dirty work. Come home to a fresh, clean yard every time.",
    icon: "sparkles",
  },
];

export const TESTIMONIALS = [
  {
    name: "Sarah M.",
    location: "Rancho Cucamonga",
    text: "DooGoodScoopers has been a lifesaver! With three dogs, our yard was a mess. Now it's always pristine. Highly recommend!",
    rating: 5,
  },
  {
    name: "Mike T.",
    location: "Fontana",
    text: "Reliable, professional, and thorough. They never miss a spot. Worth every penny for the peace of mind.",
    rating: 5,
  },
  {
    name: "Jennifer L.",
    location: "Ontario",
    text: "I was skeptical at first, but after one month I'm hooked. My kids can finally play in the backyard without worry!",
    rating: 5,
  },
  {
    name: "David R.",
    location: "Upland",
    text: "The team is always on time and so friendly. Our Great Dane produces a lot of waste, but they handle it like pros.",
    rating: 5,
  },
  {
    name: "Lisa K.",
    location: "Chino Hills",
    text: "Best investment for our home. The yard smells fresh, looks great, and we actually enjoy spending time outside again.",
    rating: 5,
  },
];
