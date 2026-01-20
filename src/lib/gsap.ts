"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Default animation settings
export const defaultEase = "power3.out";
export const defaultDuration = 0.8;

// ScrollTrigger defaults
ScrollTrigger.defaults({
  toggleActions: "play none none reverse",
  start: "top 80%",
  end: "bottom 20%",
});

// Common animation presets
export const fadeInUp = {
  y: 60,
  opacity: 0,
  duration: 0.8,
  ease: defaultEase,
};

export const fadeIn = {
  opacity: 0,
  duration: 0.6,
  ease: defaultEase,
};

export const scaleIn = {
  scale: 0.8,
  opacity: 0,
  duration: 0.6,
  ease: "back.out(1.7)",
};

export const slideInLeft = {
  x: -100,
  opacity: 0,
  duration: 0.8,
  ease: defaultEase,
};

export const slideInRight = {
  x: 100,
  opacity: 0,
  duration: 0.8,
  ease: defaultEase,
};

export { gsap, ScrollTrigger };
