"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Sparkles, PawPrint } from "lucide-react";
import { FloatingElements } from "@/components/animations/FloatingElements";
import { TextReveal, LineReveal } from "@/components/animations/TextReveal";

export function Hero() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Lawn Background Image with Scroll Fade */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 z-0"
      >
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/images/lawn-background.webp')",
          }}
        />
        {/* Top Gradient Fade - fades the image at the top */}
        <div className="absolute inset-0 bg-gradient-to-b from-navy-900 via-navy-900/70 to-transparent" />
        {/* Dark Overlay for text readability */}
        <div className="absolute inset-0 bg-navy-900/40" />
      </motion.div>

      {/* Base dark gradient fallback */}
      <div className="absolute inset-0 bg-gradient-dark -z-10" />

      {/* Floating Background Elements */}
      <FloatingElements />

      {/* Content */}
      <motion.div
        style={{ y, opacity }}
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center"
      >
        {/* Promo Badge with Animated Glow */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6, ease: "backOut" }}
          className="relative inline-block mb-8"
        >
          {/* Orbiting glow with trail effect */}
          <div className="promo-glow-border" />
          {/* Inner content with original outline */}
          <div className="relative inline-flex items-center gap-2 px-5 py-2.5 bg-navy-900/90 backdrop-blur-sm rounded-full border border-teal-400/30">
            <Sparkles className="w-4 h-4 text-teal-300 animate-pulse" />
            <span className="text-teal-200 font-medium text-sm">
              NEW YEAR&apos;S SPECIAL! 25% OFF YOUR FIRST MONTH OF SERVICE!
            </span>
          </div>
        </motion.div>

        {/* Main Heading */}
        <div className="mb-12">
          <LineReveal delay={0.1} className="mb-1">
            <p
              className="text-2xl md:text-3xl font-bold text-teal-300 tracking-wide"
              style={{ textShadow: '0 0 20px rgba(156, 213, 207, 0.6)' }}
            >
              Take Back Control of Your Lawn
            </p>
          </LineReveal>
          <h1 id="hero-heading" className="font-[family-name:var(--font-bebas)] tracking-wide uppercase">
            <TextReveal
              className="text-display-xl text-white block"
              delay={0.2}
              staggerDelay={0.05}
              as="span"
            >
              RELIABLE DOG POOP REMOVAL
            </TextReveal>
            <TextReveal
              className="text-display-lg text-teal-300 block"
              delay={0.5}
              staggerDelay={0.04}
              as="span"
            >
              FOR A CLEANER, HEALTHIER YARD
            </TextReveal>
          </h1>
          <LineReveal delay={0.7} className="mt-1">
            <p
              className="text-xl md:text-2xl font-bold text-white tracking-wide"
              style={{ textShadow: '0 0 20px rgba(255, 255, 255, 0.5)' }}
            >
              Hassle-Free Pooper Scooper Service You Can Count On!
            </p>
          </LineReveal>
        </div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/quote"
              className="btn-primary text-lg px-8 py-4 group"
            >
              Get My Free Quote
              <ArrowRight className="inline-block ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/about-doogoodscoopers"
              className="inline-flex items-center justify-center rounded-full border-2 border-white bg-white/10 text-white font-semibold hover:bg-white hover:text-navy-900 text-lg px-8 py-4 backdrop-blur-sm transition-all duration-300"
            >
              Learn More
            </Link>
          </motion.div>
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-8 text-white/50"
        >
          <div className="flex items-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.4 + i * 0.1 }}
                >
                  <PawPrint className="w-5 h-5 text-[#008EFF] fill-[#008EFF]" />
                </motion.div>
              ))}
            </div>
            <span className="text-white/70">5.0 Rating</span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <span>521+ Happy Families</span>
          <div className="h-4 w-px bg-white/20" />
          <span>90+ ZIP Codes Served</span>
        </motion.div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center pt-2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-teal-400"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
