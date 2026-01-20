import type { Metadata } from "next";
import { Montserrat, Bebas_Neue } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://doogoodscoopers.com"),
  title: {
    default: "DooGoodScoopers | Professional Dog Waste Removal | Inland Empire",
    template: "%s | DooGoodScoopers",
  },
  description:
    "Professional pooper scooper service throughout the Inland Empire. Reliable dog poop removal for a cleaner, healthier yard. Serving 60+ zip codes in San Bernardino and LA counties.",
  keywords: [
    "dog waste removal",
    "pooper scooper service",
    "pet waste removal",
    "dog poop cleanup",
    "Inland Empire",
    "Rancho Cucamonga",
    "Fontana",
    "Ontario",
    "Upland",
    "Chino Hills",
    "San Bernardino County",
    "yard cleaning service",
  ],
  authors: [{ name: "DooGoodScoopers" }],
  creator: "DooGoodScoopers",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://doogoodscoopers.com",
    siteName: "DooGoodScoopers",
    title: "DooGoodScoopers | Professional Dog Waste Removal",
    description:
      "Take back control of your lawn with reliable dog poop removal service. Serving the Inland Empire.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "DooGoodScoopers - Professional Dog Waste Removal Service",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DooGoodScoopers | Professional Dog Waste Removal",
    description:
      "Take back control of your lawn with reliable dog poop removal service.",
    images: ["/images/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${bebasNeue.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#002842" />
      </head>
      <body className="antialiased">
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              name: "DooGoodScoopers",
              description:
                "Professional dog waste removal service in the Inland Empire",
              url: "https://doogoodscoopers.com",
              telephone: "(909) 366-3744",
              email: "service@doogoodscoopers.com",
              address: {
                "@type": "PostalAddress",
                streetAddress: "11799 Sebastian Way, Suite 103",
                addressLocality: "Rancho Cucamonga",
                addressRegion: "CA",
                postalCode: "91730",
                addressCountry: "US",
              },
              geo: {
                "@type": "GeoCoordinates",
                latitude: 34.1064,
                longitude: -117.5931,
              },
              openingHoursSpecification: [
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                  opens: "07:30",
                  closes: "18:00",
                },
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: ["Saturday", "Sunday"],
                  opens: "09:00",
                  closes: "17:00",
                },
              ],
              areaServed: {
                "@type": "GeoCircle",
                geoMidpoint: {
                  "@type": "GeoCoordinates",
                  latitude: 34.0633,
                  longitude: -117.6509,
                },
                geoRadius: "50 miles",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "5.0",
                reviewCount: "111",
              },
              priceRange: "$$",
              image: "https://doogoodscoopers.com/images/og-image.jpg",
              sameAs: [
                "https://facebook.com/doogoodscoopers",
                "https://instagram.com/doogoodscoopers",
              ],
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
