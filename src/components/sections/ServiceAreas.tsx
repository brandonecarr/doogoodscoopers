"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { MapPin, CheckCircle } from "lucide-react";
import { SERVICE_AREAS } from "@/lib/constants";
import Link from "next/link";

export function ServiceAreas() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <section ref={ref} className="py-24 bg-navy-900 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-teal-400" />
              <span className="text-teal-400 font-medium uppercase tracking-wider text-sm">
                Service Coverage
              </span>
            </div>

            <h2 className="text-display-sm font-bold mb-6">
              Proudly Serving the{" "}
              <span className="text-teal-300">Inland Empire</span>
            </h2>

            <p className="text-white/70 text-lg leading-relaxed mb-8">
              We provide professional dog waste removal services throughout San Bernardino
              and Los Angeles counties. Our team serves over 60 zip codes, bringing
              reliable and thorough service to neighborhoods across the region.
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 text-teal-300">
                <CheckCircle className="w-5 h-5" />
                <span>60+ ZIP Codes</span>
              </div>
              <div className="flex items-center gap-2 text-teal-300">
                <CheckCircle className="w-5 h-5" />
                <span>Same-Day Quotes</span>
              </div>
              <div className="flex items-center gap-2 text-teal-300">
                <CheckCircle className="w-5 h-5" />
                <span>Flexible Scheduling</span>
              </div>
            </div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href="/quote"
                className="btn-primary inline-flex items-center gap-2"
              >
                Check Your Area
                <MapPin className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Cities Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            className="relative"
          >
            {/* Decorative Elements */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={isInView ? { scale: 1, opacity: 0.1 } : {}}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-teal-400 blur-3xl"
            />

            <div className="relative bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-400" />
                Cities We Serve
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SERVICE_AREAS.map((city) => (
                  <motion.div
                    key={city}
                    variants={itemVariants}
                    whileHover={{ scale: 1.05, x: 5 }}
                    className="flex items-center gap-2 text-white/80 hover:text-teal-300 transition-colors cursor-default"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                    <span className="text-sm">{city}</span>
                  </motion.div>
                ))}
              </div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ delay: 1 }}
                className="mt-6 text-white/50 text-sm"
              >
                Don&apos;t see your city? Contact us — we may still serve your area!
              </motion.p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
