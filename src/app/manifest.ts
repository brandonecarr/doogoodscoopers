import type { MetadataRoute } from "next";

// PWA manifest — enables "Add to Home Screen" to launch the app standalone
// (no address bar / browser chrome). start_url points at the admin dashboard,
// which is what this Vercel deployment is used for.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DooGoodScoopers Admin",
    short_name: "DGS Admin",
    description: "DooGoodScoopers CRM — leads, customers, reviews, campaigns, and email.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#002842",
    theme_color: "#002842",
    icons: [
      { src: "/logo-dark.png", sizes: "any", type: "image/png", purpose: "any" },
      { src: "/dog-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
